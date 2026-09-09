import { render, screen } from '@testing-library/react-native';
import { ComingSoonRow } from './ComingSoonRow';

describe('ComingSoonRow', () => {
  it('renders the title and a real Coming Soon badge', () => {
    render(<ComingSoonRow testID="row" icon="bell" title="Workout Reminders" />);

    expect(screen.getByTestId('row')).toHaveTextContent(/Workout Reminders/);
    expect(screen.getByTestId('row')).toHaveTextContent(/Coming Soon/);
  });

  it('renders an optional subtitle', () => {
    render(<ComingSoonRow testID="row" icon="bell" title="Title" subtitle="Details" />);

    expect(screen.getByTestId('row')).toHaveTextContent(/Details/);
  });
});
