import { render, screen } from '@testing-library/react-native';
import { MetricCard } from './MetricCard';

describe('MetricCard', () => {
  it('shows the label and value with a unit', () => {
    render(<MetricCard label="Top Set" value={225} unit="lb" testID="metric" />);

    expect(screen.getByText('Top Set')).toBeTruthy();
    expect(screen.getByTestId('metric')).toHaveTextContent(/225/);
    expect(screen.getByTestId('metric')).toHaveTextContent(/lb/);
  });

  it('shows an empty-state message instead of a fake value when there is no data', () => {
    render(<MetricCard label="1RM" value={null} testID="metric" />);

    expect(screen.getByText('No data yet')).toBeTruthy();
  });

  it('supports a custom empty-state message', () => {
    render(<MetricCard label="PRs" value={null} emptyLabel="No PRs yet" testID="metric" />);

    expect(screen.getByText('No PRs yet')).toBeTruthy();
  });
});
