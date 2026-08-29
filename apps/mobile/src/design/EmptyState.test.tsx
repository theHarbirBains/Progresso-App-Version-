import { render, screen } from '@testing-library/react-native';
import { EmptyState } from './EmptyState';

describe('EmptyState', () => {
  it('renders its title', () => {
    render(<EmptyState testID="empty" title="Start your first workout" />);

    expect(screen.getByTestId('empty')).toHaveTextContent('Start your first workout');
  });
});
