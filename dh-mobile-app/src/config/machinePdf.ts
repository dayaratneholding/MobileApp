/**
 * Demo storage paths for machine PDF uploads.
 * Replace these with your real paths when ready.
 */
export const MACHINE_PDF_PATHS = {
  OUT: 'D:/DH_Mobile/MachinePDFs/OUT',
  IN: 'D:/DH_Mobile/MachinePDFs/IN',
} as const;

export type MachineDirection = keyof typeof MACHINE_PDF_PATHS;
