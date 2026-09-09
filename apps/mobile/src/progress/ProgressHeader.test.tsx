import { render, screen } from '@testing-library/react-native';
import { ProgressHeader } from './ProgressHeader';

describe('ProgressHeader', () => {
  it('renders the given title', () => {
    render(<ProgressHeader title="Progress" />);

    expect(screen.getByText('Progress')).toBeTruthy();
  });

  it('renders an optional subtitle', () => {
    render(<ProgressHeader title="Progress" subtitle="Track how you're getting stronger." />);

    expect(screen.getByTestId('progress-header-subtitle')).toHaveTextContent(
      "Track how you're getting stronger.",
    );
  });

  it('renders no subtitle element when none is given', () => {
    render(<ProgressHeader title="Progress" />);

    expect(screen.queryByTestId('progress-header-subtitle')).toBeNull();
  });
});
