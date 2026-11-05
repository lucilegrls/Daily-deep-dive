/** Fit publisher PDFs to the reader without changing the user's zoom multiplier. */
export function pdfScale(pageWidth: number, availableWidth: number, zoom: number): number {
  return Math.min(1, Math.max(1, availableWidth) / pageWidth) * zoom;
}
export function pdfPage(page: number, total: number): number {
  return Math.min(Math.max(1, Math.trunc(page) || 1), Math.max(1, total));
}
export const PDF_LOAD_TIMEOUT_MS = 20_000;