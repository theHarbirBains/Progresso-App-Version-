import { requireOptionalNativeModule } from 'expo';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { TurboModuleRegistry } from 'react-native';

// Whether this copy of the app was built with a native piece. A real build has everything in
// app.json; Expo Go -- Expo's own preview app, for trying the app without a build -- has only what
// Expo ships, so it has neither the Home Screen widgets nor Apple Health. What needs one checks
// here first and does without it, rather than loading code whose native side isn't there: Metro
// treats a file that fails while it loads after startup as fatal, so the app would stop.

/** Running in Expo Go. */
function inExpoGo(): boolean {
  return Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
}

/**
 * The widgets' native side: expo-widgets, and Expo UI, whose SwiftUI views the layouts use --
 * never in Expo Go, even one that carries those modules itself: it has none of this app's own
 * widget extension or App Group, so there is nothing for the widgets to live in.
 */
export function hasWidgetsNative(): boolean {
  return (
    !inExpoGo() &&
    requireOptionalNativeModule('ExpoWidgets') != null &&
    requireOptionalNativeModule('ExpoUI') != null
  );
}

/** Apple Health's native side: the library is built on Nitro modules. */
export function hasHealthKitNative(): boolean {
  return TurboModuleRegistry.get('NitroModules') != null;
}
