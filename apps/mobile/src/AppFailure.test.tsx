import { fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';
import { Pressable, Text } from 'react-native';
import { recordQuietFailure } from './lib/sentry';
import { AppErrorBoundary, AppFailure } from './AppFailure';

jest.mock('./lib/sentry', () => ({ recordQuietFailure: jest.fn() }));

beforeEach(() => {
  jest.clearAllMocks();
});

it('says what went wrong while the app was opening, with nothing to retry', () => {
  render(<AppFailure error={new Error("Cannot find native module 'ExpoWidgets'")} />);

  expect(screen.getByTestId('app-failure')).toHaveTextContent(/Progresso hit a problem/);
  expect(screen.getByTestId('app-failure-message')).toHaveTextContent(
    "Cannot find native module 'ExpoWidgets'",
  );
  expect(screen.queryByTestId('app-failure-retry')).toBeNull();
});

it('shows something readable for a thrown value that is not an Error', () => {
  render(<AppFailure error={{ code: 7 }} />);
  expect(screen.getByTestId('app-failure-message')).toHaveTextContent('{"code":7}');
});

describe('AppErrorBoundary', () => {
  function Breaks({ when }: { when: boolean }) {
    if (when) throw new Error('Feed failed to draw');
    return <Text testID="fine">Fine</Text>;
  }

  function Harness() {
    const [broken, setBroken] = useState(true);
    return (
      <>
        <Pressable testID="mend" onPress={() => setBroken(false)} />
        <AppErrorBoundary>
          <Breaks when={broken} />
        </AppErrorBoundary>
      </>
    );
  }

  it('shows the failure instead of a blank screen, records it, and tries again', () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    render(<Harness />);

    expect(screen.getByTestId('app-failure-message')).toHaveTextContent('Feed failed to draw');
    expect(recordQuietFailure).toHaveBeenCalledWith('app.render', expect.any(Error));

    fireEvent.press(screen.getByTestId('mend'));
    fireEvent.press(screen.getByTestId('app-failure-retry'));
    expect(screen.getByTestId('fine')).toBeTruthy();
    consoleError.mockRestore();
  });
});
