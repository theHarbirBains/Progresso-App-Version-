export const SETTINGS_CATEGORIES = [
  { key: 'Account', label: 'Account' },
  { key: 'Appearance', label: 'Appearance' },
  { key: 'App', label: 'App' },
  { key: 'Notifications', label: 'Notifications' },
  { key: 'Privacy', label: 'Privacy' },
  { key: 'Help', label: 'Help' },
] as const;

export type SettingsCategory = (typeof SETTINGS_CATEGORIES)[number]['key'];
