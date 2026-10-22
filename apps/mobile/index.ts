// Must be imported before any code that uses fetch/URL (Supabase client
// included) — React Native's URL implementation is incomplete otherwise.
import 'react-native-url-polyfill/auto';

import { registerRootComponent } from 'expo';
import { createElement, type ComponentType } from 'react';

import { AppErrorBoundary, AppFailure } from './src/AppFailure';
import { initSentry } from './src/lib/sentry';

// As early as possible, before any other app code runs.
initSentry();

// The app's code is loaded here rather than imported above, so that a failure while it loads
// shows on screen (AppFailure) instead of leaving a blank one -- a release build shows nothing
// otherwise -- and a screen that throws while drawing does the same (AppErrorBoundary).
function loadApp(): ComponentType {
  try {
    // A plain require: it has to happen inside the try, and before anything is shown.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const App = (require('./App') as { default: ComponentType }).default;
    return function Root() {
      return createElement(AppErrorBoundary, null, createElement(App));
    };
  } catch (error) {
    return function FailedToLoad() {
      return createElement(AppFailure, { error });
    };
  }
}

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(loadApp());
