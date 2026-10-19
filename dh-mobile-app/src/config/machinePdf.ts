/**
 * File Manager paths for machine PDF uploads (same process as itemscreen).
 *
 * Folder Name  = IN | OUT
 * Upload Path  = MachinePDFs/{IN|OUT}
 * File         = MachinePDFs/{IN|OUT}/{createdFileName}.pdf
 */
export const MACHINE_PDF_MODULE_ROOT = 'MachinePDFs';

export const MACHINE_PDF_PATHS = {
  OUT: `${MACHINE_PDF_MODULE_ROOT}/OUT`,
  IN: `${MACHINE_PDF_MODULE_ROOT}/IN`,
} as const;

export type MachineDirection = keyof typeof MACHINE_PDF_PATHS;

export function getMachineFolderName(direction: MachineDirection): string {
  return direction;
}

export function getMachineUploadPath(direction: MachineDirection): string {
  return MACHINE_PDF_PATHS[direction];
}
