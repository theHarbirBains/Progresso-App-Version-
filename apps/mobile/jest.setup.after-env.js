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
