import { requireOptionalNativeModule } from 'expo';
import { TurboModuleRegistry } from 'react-native';

// Whether this copy of the app was built with a native piece. A real build has everything in
// app.json; Expo Go -- Expo's own preview app, for trying the app without a build -- has only what
// Expo ships, so it has neither the Home Screen widgets nor Apple Health. What needs one checks
// here first and does without it, rather than loading code whose native side isn't there: Metro
// treats a file that fails while it loads after startup as fatal, so the app would stop.

/** The widgets' native side: expo-widgets, and Expo UI, whose SwiftUI views the layouts use. */
export function hasWidgetsNative(): boolean {
  return (
    requireOptionalNativeModule('ExpoWidgets') != null &&
    requireOptionalNativeModule('ExpoUI') != null
  );
}

/** Apple Health's native side: the library is built on Nitro modules. */
export function hasHealthKitNative(): boolean {
  return TurboModuleRegistry.get('NitroModules') != null;
}
