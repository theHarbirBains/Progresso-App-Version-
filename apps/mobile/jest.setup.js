// react-native-safe-area-context has no real native module in the Jest
// environment; its own package ships this mock for exactly this purpose
// (see its README). Applied globally here since ScreenContainer -- and so
// every screen that uses it -- depends on useSafeAreaInsets().
jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
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
