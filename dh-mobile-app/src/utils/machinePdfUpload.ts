import * as DocumentPicker from 'expo-document-picker';
import { Platform } from 'react-native';
import {
  createFolder,
  uploadFiles,
  type FileUploadResultItem,
} from '../api/client/fileManagerClient';
import {
  getMachineFolderName,
  getMachineUploadPath,
  type MachineDirection,
} from '../config/machinePdf';
import { getApiErrorMessage } from '../api/client/client';

export type PickedPdf = {
  uri: string;
  name: string;
  size: number | null;
};

export type UploadedMachinePdf = {
  originalName: string;
  /** File creation name uploaded to File Manager */
  savedName: string;
  folderName: string;
  uploadPath: string;
  remotePath: string;
  uploaded?: FileUploadResultItem;
};

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/**
 * File creation name — same idea as itemscreen buildFolderFileName.
 * e.g. OUT_2026-03-19_15-30-45.pdf
 */
export function buildMachinePdfFilename(
  direction: MachineDirection,
  date = new Date(),
): string {
  const stamp = [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join('-');

  const time = [
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join('-');

  return `${direction}_${stamp}_${time}.pdf`;
}

export function getConfiguredMachinePath(direction: MachineDirection): string {
  return getMachineUploadPath(direction);
}

export async function pickPdf(): Promise<PickedPdf | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: 'application/pdf',
    copyToCacheDirectory: true,
    multiple: false,
  });

  if (result.canceled || !result.assets?.[0]) {
    return null;
  }

  const asset = result.assets[0];
  const name = asset.name?.toLowerCase().endsWith('.pdf')
    ? asset.name
    : `${asset.name ?? 'document'}.pdf`;

  return {
    uri: asset.uri,
    name,
    size: asset.size ?? null,
  };
}

/**
 * Same File Manager process as itemscreen:
 *  1) POST /api/folders  { path: MachinePDFs/IN|OUT }
 *  2) POST /api/files/upload  multipart path + renamed file
 */
export async function uploadMachinePdf(
  direction: MachineDirection,
  picked: PickedPdf,
): Promise<UploadedMachinePdf> {
  const folderName = getMachineFolderName(direction);
  const uploadPath = getMachineUploadPath(direction);
  const savedName = buildMachinePdfFilename(direction);

  try {
    await createFolder(uploadPath);

    const uploadRes = await uploadFiles(
      uploadPath,
      [
        {
          uri: picked.uri,
          name: savedName,
          type: 'application/pdf',
        },
      ],
      true,
    );

    const first = uploadRes?.uploaded?.[0];
    const remotePath =
      first?.path || `/${uploadPath}/${savedName}`.replace(/\/+/g, '/');

    if (__DEV__) {
      console.log('[MachinePDF] Uploaded via File Manager:', {
        direction,
        folderName,
        uploadPath,
        savedName,
        remotePath,
        platform: Platform.OS,
        uploaded: first,
      });
    }

    return {
      originalName: picked.name,
      savedName: first?.name || savedName,
      folderName,
      uploadPath,
      remotePath,
      uploaded: first,
    };
  } catch (err) {
    throw new Error(getApiErrorMessage(err));
  }
}

export function formatFileSize(bytes: number | null): string {
  if (bytes == null || Number.isNaN(bytes)) {
    return 'Unknown size';
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
