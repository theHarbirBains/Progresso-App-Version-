import { render, screen } from '@testing-library/react-native';
import { LaunchScreen } from './LaunchScreen';

describe('LaunchScreen', () => {
  it('renders the logo while not ready', () => {
    render(<LaunchScreen ready={false} />);

    expect(screen.getByTestId('launch-screen')).toBeTruthy();
    expect(screen.getByTestId('launch-logo')).toBeTruthy();
  });

  it('still renders once ready (stays mounted through its own exit fade)', () => {
    const { rerender } = render(<LaunchScreen ready={false} />);

    rerender(<LaunchScreen ready />);

    expect(screen.getByTestId('launch-screen')).toBeTruthy();
  });
});
