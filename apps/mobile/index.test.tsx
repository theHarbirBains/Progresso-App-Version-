import { render, screen } from '@testing-library/react-native';
import type { ComponentType } from 'react';
import { Text } from 'react-native';

// index.ts registers the app. Loaded here in isolation, with the app itself mocked, to check what
// it registers: the app inside an error boundary, or, when the app's code fails to load, a screen
// saying why -- never nothing.

function registered(app: () => unknown): ComponentType {
  let root: ComponentType | undefined;
  jest.isolateModules(() => {
    jest.doMock('expo', () => ({
      registerRootComponent: (component: ComponentType) => {
        root = component;
      },
    }));
    jest.doMock('react-native-url-polyfill/auto', () => ({}));
    jest.doMock('./src/lib/sentry', () => ({
      initSentry: jest.fn(),
      recordQuietFailure: jest.fn(),
    }));
    jest.doMock('./App', app);
    jest.requireActual('./index');
  });
  if (!root) throw new Error('nothing was registered');
  return root;
}

it('registers the app', () => {
  const Root = registered(() => ({
    __esModule: true,
    default: () => <Text testID="the-app">App</Text>,
  }));
  render(<Root />);
  expect(screen.getByTestId('the-app')).toBeTruthy();
});

it("shows why, instead of a blank screen, when the app's code fails to load", () => {
  const Root = registered(() => {
    throw new Error('NitroModules are not installed');
  });
  render(<Root />);
  expect(screen.getByTestId('app-failure-message')).toHaveTextContent(
    'NitroModules are not installed',
  );
});
