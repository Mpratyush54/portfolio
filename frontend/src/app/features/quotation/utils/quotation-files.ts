import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { cleanVisibleText } from '../../../core/text';

export function cleanDraftText(value: any): any {
  if (typeof value === 'string') return cleanVisibleText(value);
  if (Array.isArray(value)) return value.map(cleanDraftText);
  if (value && typeof value === 'object')
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, cleanDraftText(v)]));
  return value;
}

export async function downloadQuotationFile(
  http: HttpClient,
  url: string,
  headers: HttpHeaders,
  name: string,
) {
  try {
    const blob = await firstValueFrom(http.get(url, { headers, responseType: 'blob' }));
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 30000);
  } catch (error: any) {
    if (error.error instanceof Blob) {
      try {
        error.error = JSON.parse(await error.error.text());
      } catch {
        /* Use the fallback message. */
      }
    }
    throw error;
  }
}
