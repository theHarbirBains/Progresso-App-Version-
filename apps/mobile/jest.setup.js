// react-native-safe-area-context has no real native module in the Jest
// environment; its own package ships this mock for exactly this purpose
// (see its README). Applied globally here since ScreenContainer -- and so
// every screen that uses it -- depends on useSafeAreaInsets().
jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);

// Same situation as safe-area-context: no real native module in Jest.
// Applied globally since BackgroundThemeContext (and so anything that
// renders AppearanceCategory/AccountSettingsScreen, or App.tsx itself)
// depends on it now, not just lib/supabase.ts's storage adapter.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// expo-font's native loader (ExpoFontLoader) has no jest-expo auto-mock.
// @expo/vector-icons imports expo-font internally, so this now affects any
// screen that renders an icon, not just App.tsx's own useFonts() call --
// applied globally rather than repeated per test file. Fonts always report
// as "loaded" in tests; nothing here exercises real font loading.
jest.mock('expo-font', () => ({
  useFonts: () => [true],
  loadAsync: jest.fn().mockResolvedValue(undefined),
  isLoaded: () => true,
}));

// Expo's SDK 57 "winter" runtime installs global.fetch as a lazy getter
// that, on first access, requires a real native module (ExpoFetchModule)
// with no jest-expo auto-mock -- so merely *reading* global.fetch (e.g.
// api.test.ts capturing it to restore later) crashes. Assigning a plain
// function here -- never reading the getter first -- replaces it with an
// ordinary property so nothing ever tries to reach the native module.
// Nothing in this suite relies on a real network fetch; every test that
// cares mocks global.fetch itself.
global.fetch = jest.fn();

// expo-image-picker has no jest-expo auto-mock either (its native module
// resolution crashes jest-expo's own mock lookup, not just "no native
// implementation"). Only the functions/enum ProfileScreen's Choose Photo
// flow and ExerciseFormScreen's Add Machine Photo flow use are exported
// here; permission defaults to granted and the picker defaults to
// "cancelled" so any test that doesn't care about a photo-picker flow is
// unaffected -- tests that do exercise it override these mocks' resolved
// values themselves.
jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  launchImageLibraryAsync: jest.fn().mockResolvedValue({ canceled: true, assets: null }),
  requestCameraPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  launchCameraAsync: jest.fn().mockResolvedValue({ canceled: true, assets: null }),
  MediaTypeOptions: { Images: 'Images' },
}));

// expo-linking has no jest-expo auto-mock either. AuthProvider.tsx uses it
// for the password-reset deep-link flow; GlassBackground's
// useBackgroundTheme() fallback (see BackgroundThemeContext.tsx) now pulls
// AuthProvider in transitively for *any* component that renders a glass
// surface (AppCard, BottomNavBar, SegmentedControl, ...), so this needs to
// be a global mock rather than something only auth-specific tests declare.
jest.mock('expo-linking', () => ({
  getInitialURL: jest.fn().mockResolvedValue(null),
  addEventListener: jest.fn(() => ({ remove: jest.fn() })),
  createURL: jest.fn((path) => `progresso://${path}`),
}));

// expo-blur/expo-linear-gradient (the new global glass-surface system) have
// no jest-expo auto-mock either -- both are pure native view wrappers, so a
// plain passthrough View (rendering `children`) is a faithful enough stand-in
// for every test that doesn't specifically assert on the blur/gradient
// itself.
jest.mock('expo-blur', () => {
  const { View } = require('react-native');
  return { BlurView: View };
});
jest.mock('expo-linear-gradient', () => {
  const { View } = require('react-native');
  return { LinearGradient: View };
});

// expo-camera has no jest-expo auto-mock either. Used by
// BarcodeScannerScreen.tsx's Scan Barcode flow, now imported transitively
// by App.tsx (and so by App.test.tsx too) -- a plain passthrough View plus
// an always-granted permission is a faithful enough stand-in for every test
// that doesn't specifically exercise scanning itself. Tests that do
// (BarcodeScannerScreen.test.tsx) declare their own more detailed local
// mock of this same module, which jest uses instead for that file.
jest.mock('expo-camera', () => {
  const { View } = require('react-native');
  return {
    CameraView: View,
    useCameraPermissions: () => [{ granted: true, canAskAgain: true }, jest.fn()],
  };
});

// expo-secure-store/expo-crypto have no jest-expo auto-mock either, and
// lib/supabase.ts (via SecureSessionStorage) now imports both transitively
// for basically every screen. An in-memory Map stands in for the Keychain/
// Keystore; secureSessionStorage.test.ts exercises the real encrypt/decrypt
// round trip against these mocks directly, so nothing here needs to fake
// actual randomness/entropy -- deterministic bytes are fine for every other
// test, which never inspects them.
jest.mock('expo-secure-store', () => {
  const store = new Map();
  return {
    getItemAsync: jest.fn((key) => Promise.resolve(store.get(key) ?? null)),
    setItemAsync: jest.fn((key, value) => {
      store.set(key, value);
      return Promise.resolve();
    }),
    deleteItemAsync: jest.fn((key) => {
      store.delete(key);
      return Promise.resolve();
    }),
  };
});

jest.mock('expo-crypto', () => {
  let callCount = 0;
  return {
    // Varies per call (not just per byte index) so two keys generated in
    // the same test are never accidentally identical -- deterministic
    // randomness would otherwise make a real bug (e.g. reusing one key for
    // every value) invisible to a test asserting keys differ.
    getRandomBytesAsync: jest.fn((byteCount) => {
      callCount += 1;
      const bytes = new Uint8Array(byteCount);
      for (let i = 0; i < byteCount; i += 1) bytes[i] = (i + callCount) % 256;
      return Promise.resolve(bytes);
    }),
  };
});
