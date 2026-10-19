import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import {
  MACHINE_PDF_PATHS,
  type MachineDirection,
} from '../config/machinePdf';

export type PickedPdf = {
  uri: string;
  name: string;
  size: number | null;
};

export type UploadedMachinePdf = {
  originalName: string;
  savedName: string;
  configuredPath: string;
  savedUri: string;
};

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** e.g. OUT_2026-03-19_15-30-45.pdf */
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
  return MACHINE_PDF_PATHS[direction];
}

/**
 * Resolves a writable folder for the demo.
 * Mobile apps cannot write to Windows drive letters, so we mirror the
 * configured folder name under the app document directory.
 */
export function resolveWritableMachineDirectory(
  direction: MachineDirection,
): string {
  const base = FileSystem.documentDirectory;
  if (!base) {
    throw new Error('Document directory is not available on this device.');
  }

  return `${base}MachinePDFs/${direction}/`;
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

export async function uploadMachinePdf(
  direction: MachineDirection,
  picked: PickedPdf,
): Promise<UploadedMachinePdf> {
  const savedName = buildMachinePdfFilename(direction);
  const configuredPath = getConfiguredMachinePath(direction);
  const directory = resolveWritableMachineDirectory(direction);
  const savedUri = `${directory}${savedName}`;

  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });

  await FileSystem.copyAsync({
    from: picked.uri,
    to: savedUri,
  });

  if (__DEV__) {
    console.log('[MachinePDF] Uploaded:', {
      direction,
      configuredPath,
      savedUri,
      savedName,
      platform: Platform.OS,
    });
  }

  return {
    originalName: picked.name,
    savedName,
    configuredPath,
    savedUri,
  };
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
