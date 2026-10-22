// Runs after the test framework is installed (setupFilesAfterEnv), unlike
// jest.setup.js, because configuring Testing Library needs its module loaded
// inside the test environment.
//
// waitFor/findBy* default to a 1000ms timeout. Screens here import heavy
// module graphs and run several chained async loads, so under CPU contention
// (the full parallel suite, or a slower CI runner) they can legitimately take
// longer than 1s and fail spuriously. 5s is still far below the per-test
// timeout (testTimeout in package.json), so a genuine hang still fails fast.
const { configure } = require('@testing-library/react-native');

configure({ asyncUtilTimeout: 5000 });

// lib/lastShown.ts keeps what pages last showed in memory for the session;
// each test starts as a fresh session.
const { forgetShown } = require('./src/lib/lastShown');

afterEach(() => {
  forgetShown();
});

// A widget handed something iOS's UserDefaults can't store (see the expo-widgets mock in
// jest.setup.js) would crash the app on a phone, so it fails the test here.
afterEach(() => {
  const violations = global.__widgetStorageViolations.splice(0);
  if (violations.length > 0) {
    throw new Error(
      `A widget was handed something iOS can't store, which crashes the app on a phone:\n${violations.join('\n')}`,
    );
  }
});
