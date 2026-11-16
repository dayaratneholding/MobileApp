import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { currentFileManagerBase, resolveFileManagerBase } from '../../config/serviceHosts';
import { getAuthToken } from '../../services/authToken';
import { ApiError } from './client';

export type FileUploadResultItem = {
  name: string;
  path: string;
  sizeBytes: number;
  extension: string;
  isImage: boolean;
  modifiedUtc: string;
  viewUrl: string;
  downloadUrl: string;
};

export type FileUploadResponse = {
  uploaded: FileUploadResultItem[];
  errors: string[];
};

export type UploadFilePart = {
  uri: string;
  name: string;
  type: string;
};

function logFm(path: string, details: Record<string, unknown>) {
  if (__DEV__) {
    console.log(`[FileManager] ${path}`, details);
  }
}

async function parseJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text) {
    return {} as T;
  }

  const trimmed = text.trimStart().toLowerCase();
  if (trimmed.startsWith('<!doctype') || trimmed.startsWith('<html')) {
    throw new ApiError('File Manager returned an HTML error page.');
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ApiError(`Unexpected File Manager response: ${text.slice(0, 120)}`);
  }
}

function isAlreadyExistsError(status: number, body: unknown): boolean {
  const msg = String(
    (body as { message?: string })?.message ??
      (typeof body === 'string' ? body : '') ??
      '',
  ).toLowerCase();

  return (
    status === 409 ||
    ((status === 400 || status === 403) &&
      (msg.includes('exist') || msg.includes('already')))
  );
}

/**
 * Step 1 — create folder
 * POST /api/folders  body: { path }
 */
export async function createFolder(folderPath: string): Promise<unknown> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const base = await resolveFileManagerBase();
  const url = `${base}folders`;
  const body = { path: folderPath };

  logFm('folders', { url, body, hasToken: Boolean(token) });

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
  } catch (err) {
    logFm('folders', { networkError: String(err) });
    throw new ApiError(
      `Cannot reach File Manager (${base}). The phone could not resolve the file address.`,
    );
  }

  const result = await parseJson<unknown>(response);
  logFm('folders', { status: response.status, ok: response.ok, result });

  if (!response.ok && !isAlreadyExistsError(response.status, result)) {
    const message =
      (result as { message?: string })?.message ||
      `Create folder failed (${response.status}).`;
    throw new ApiError(message);
  }

  return result;
}

/**
 * Step 2 — upload files
 * POST /api/files/upload
 * multipart: path, overwrite, files
 */
export async function uploadFiles(
  path: string,
  files: UploadFilePart[],
  overwrite = true,
): Promise<FileUploadResponse> {
  const token = getAuthToken();
  const base = await resolveFileManagerBase();
  const url = `${base}files/upload`;
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  logFm('files/upload', {
    url,
    path,
    overwrite,
    fileNames: files.map((file) => file.name),
    hasToken: Boolean(token),
  });

  const uploaded: FileUploadResultItem[] = [];
  const errors: string[] = [];

  for (const file of files) {
    const fileUri = file.uri.startsWith('/') ? `file://${file.uri}` : file.uri;
    let result: FileSystem.FileSystemUploadResult;
    try {
      result = await FileSystem.uploadAsync(url, fileUri, {
        httpMethod: 'POST',
        uploadType: FileSystem.FileSystemUploadType.MULTIPART,
        fieldName: 'files',
        mimeType: file.type || 'application/octet-stream',
        parameters: {
          path: path || '',
          overwrite: String(!!overwrite),
        },
        headers,
      });
    } catch (err) {
      logFm('files/upload', { networkError: String(err) });
      throw new ApiError(
        `Cannot reach File Manager (${base}). The phone could not send the file.`,
      );
    }

    let body: FileUploadResponse;
    try {
      body = result.body ? (JSON.parse(result.body) as FileUploadResponse) : { uploaded: [], errors: [] };
    } catch {
      throw new ApiError(`Unexpected File Manager response: ${result.body.slice(0, 120)}`);
    }
    logFm('files/upload', { status: result.status, body });

    if (result.status < 200 || result.status >= 300) {
      throw new ApiError(body.errors?.[0] || `File upload failed (${result.status}).`);
    }
    uploaded.push(...(body.uploaded ?? []));
    errors.push(...(body.errors ?? []));
  }

  if (errors.length && uploaded.length === 0) {
    throw new ApiError(errors[0] || 'File upload failed.');
  }

  return { uploaded, errors };
}

/** File Manager often returns a path with no host. Android then treats it as an app resource. */
export function absoluteFileUrl(url: string): string {
  const trimmed = url.trim().replace(/^https?:\/\/2\.24\.130\.171:5000/i, 'https://files.pskerp.com');
  if (!trimmed) return '';
  const base = currentFileManagerBase();
  const origin = base.replace(/\/api\/?$/i, '');
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) {
    if (base.startsWith('http://2.24.130.171:5000') && trimmed.startsWith('https://files.pskerp.com')) {
      return trimmed.replace('https://files.pskerp.com', 'http://2.24.130.171:5000');
    }
    return trimmed;
  }

  if (trimmed.startsWith('/')) return `${origin}${trimmed}`;
  return `${base}${trimmed.replace(/^\/+/, '')}`;
}

function safeFileName(name: string): string {
  const cleaned = name.replace(/[\\/:*?"<>|]/g, '_').trim();
  return cleaned || 'file';
}

function mimeForName(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase();
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'png') return 'image/png';
  if (ext === 'gif') return 'image/gif';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'pdf') return 'application/pdf';
  if (ext === 'mp4') return 'video/mp4';
  if (ext === 'mp3' || ext === 'm4a') return 'audio/mpeg';
  return 'application/octet-stream';
}

/** Camera photos are often content links. Copy them to a real file before upload. */
export async function localFileForUpload(uri: string, fileName: string): Promise<string> {
  if (!FileSystem.cacheDirectory) return uri;
  const destination = `${FileSystem.cacheDirectory}upload-${Date.now()}-${safeFileName(fileName)}`;
  const from = uri.startsWith('/') ? `file://${uri}` : uri;
  await FileSystem.copyAsync({ from, to: destination });
  return destination;
}

async function cacheSharedFile(url: string, fileName: string): Promise<{ uri: string; name: string }> {
  const absolute = absoluteFileUrl(url);
  if (!absolute) {
    throw new ApiError('This file has no download link.');
  }
  if (!FileSystem.cacheDirectory) {
    throw new ApiError('This phone has no place to save the file.');
  }

  const name = safeFileName(fileName);
  const destination = `${FileSystem.cacheDirectory}${Date.now()}-${name}`;
  const token = getAuthToken();
  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let result: FileSystem.FileSystemDownloadResult;
  try {
    result = await FileSystem.downloadAsync(absolute, destination, { headers });
  } catch (err) {
    logFm('download', { url: absolute, error: String(err) });
    throw new ApiError('The phone could not download this file.');
  }
  if (result.status < 200 || result.status >= 300) {
    throw new ApiError(`Download failed (${result.status}).`);
  }
  return { uri: result.uri, name };
}

function viewFileName(fileName: string, url: string): string {
  const name = safeFileName(fileName);
  const looksLikePdf = /\.pdf(?:$|[?#])/i.test(`${name} ${url}`);
  if (looksLikePdf && !name.toLowerCase().endsWith('.pdf')) {
    return `${name}.pdf`;
  }
  return name;
}

/** Open a downloaded chat file in the phone viewer. */
export async function viewSharedFile(url: string, fileName: string): Promise<void> {
  const viewUrl = url.replace('/api/files/download?', '/api/files/view?');
  const saved = await cacheSharedFile(viewUrl, viewFileName(fileName, viewUrl));
  const mimeType = mimeForName(saved.name);
  if (Platform.OS === 'android') {
    const contentUri = await FileSystem.getContentUriAsync(saved.uri);
    try {
      await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
        data: contentUri,
        flags: 1,
        type: mimeType,
      });
      return;
    } catch {
      await Sharing.shareAsync(saved.uri, {
        mimeType,
        dialogTitle: 'View file',
      });
      return;
    }
  }
  await Sharing.shareAsync(saved.uri, {
    mimeType,
    dialogTitle: 'View file',
  });
}

/** Download a chat attachment and open the phone save/share sheet. */
export async function downloadSharedFile(url: string, fileName: string): Promise<void> {
  const saved = await cacheSharedFile(url, fileName);
  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new ApiError('Saving files is not available on this phone.');
  }

  await Sharing.shareAsync(saved.uri, {
    mimeType: mimeForName(saved.name),
    dialogTitle: 'Save file',
  });
}
