import Constants from 'expo-constants';
import { Platform } from 'react-native';

export interface SentFrom {
  appVersion?: string;
  buildNumber?: string;
  platform?: 'ios' | 'android';
  osVersion?: string;
}

/**
 * The app version, build, platform and system version a piece of feedback is sent from -- each
 * only where the app can tell (no build inside Expo Go, say), never made up.
 */
export function sentFrom(): SentFrom {
  const info: SentFrom = {};
  const version = Constants.expoConfig?.version;
  if (version) info.appVersion = version.slice(0, 32);
  const build = Constants.nativeBuildVersion;
  if (build) info.buildNumber = String(build).slice(0, 32);
  if (Platform.OS === 'ios' || Platform.OS === 'android') {
    info.platform = Platform.OS;
    info.osVersion = String(Platform.Version).slice(0, 32);
  }
  return info;
}

/** "Progresso 1.4.0 (31) · iOS 18.1" -- as much of it as is known. */
export function sentFromText(info: SentFrom): string {
  const app = info.appVersion
    ? `Progresso ${info.appVersion}${info.buildNumber ? ` (${info.buildNumber})` : ''}`
    : null;
  const system = info.platform
    ? `${info.platform === 'ios' ? 'iOS' : 'Android'}${info.osVersion ? ` ${info.osVersion}` : ''}`
    : null;
  return [app, system].filter(Boolean).join(' · ');
}
