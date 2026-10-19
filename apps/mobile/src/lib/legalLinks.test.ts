import * as WebBrowser from 'expo-web-browser';
import { legalPageUrl, openLegalPage } from './legalLinks';

jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn() }));

const original = process.env.EXPO_PUBLIC_API_BASE_URL;
afterEach(() => {
  process.env.EXPO_PUBLIC_API_BASE_URL = original;
});

describe('legal links', () => {
  it('points at the pages the API serves, whether or not the base URL ends in a slash', () => {
    process.env.EXPO_PUBLIC_API_BASE_URL = 'https://api.example.com/';
    expect(legalPageUrl('privacy')).toBe('https://api.example.com/legal/privacy');
    process.env.EXPO_PUBLIC_API_BASE_URL = 'https://api.example.com';
    expect(legalPageUrl('terms')).toBe('https://api.example.com/legal/terms');
  });

  it('opens a page in the in-app browser', async () => {
    process.env.EXPO_PUBLIC_API_BASE_URL = 'https://api.example.com';
    await openLegalPage('privacy');
    expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith(
      'https://api.example.com/legal/privacy',
    );
  });
});
