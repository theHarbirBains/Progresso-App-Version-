import * as WebBrowser from 'expo-web-browser';
import { getApiBaseUrl } from './apiClient';

// The Privacy Policy and Terms of Service are web pages the API serves (apps/api/src/legal),
// so they can change without an app update and App Store Connect can link the same pages.
export type LegalPage = 'privacy' | 'terms';

export function legalPageUrl(page: LegalPage): string {
  return `${getApiBaseUrl().replace(/\/+$/, '')}/legal/${page}`;
}

/** Opens the page in the in-app browser. */
export async function openLegalPage(page: LegalPage): Promise<void> {
  await WebBrowser.openBrowserAsync(legalPageUrl(page));
}
