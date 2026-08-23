// Must be imported before any code that uses fetch/URL (Supabase client
// included) — React Native's URL implementation is incomplete otherwise.
import 'react-native-url-polyfill/auto';

import { registerRootComponent } from 'expo';

import App from './App';
import { initSentry } from './src/lib/sentry';

// As early as possible, before any other app code runs.
initSentry();

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
