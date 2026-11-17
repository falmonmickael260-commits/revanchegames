export const REPORT_MAX_CAPTURES = 3;
export const REPORT_MAX_CAPTURE_BYTES = 5 * 1024 * 1024;
export const REPORT_CAPTURE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export function validateReportCaptures(files: readonly { size: number; type: string }[]): string | null {
  if (files.length > REPORT_MAX_CAPTURES) return 'Ajoute au maximum 3 captures par signalement.';
  if (files.some(file => file.size === 0)) return 'Une des captures est vide.';
  if (files.some(file => file.size > REPORT_MAX_CAPTURE_BYTES)) return 'Chaque capture doit faire au maximum 5 Mo.';
  if (files.some(file => !REPORT_CAPTURE_TYPES.includes(file.type))) return 'Formats acceptés : JPEG, PNG et WebP.';
  return null;
}
