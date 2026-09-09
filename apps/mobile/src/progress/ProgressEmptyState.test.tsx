import { render, screen } from '@testing-library/react-native';
import { ProgressEmptyState } from './ProgressEmptyState';

describe('ProgressEmptyState', () => {
  it('renders the given title', () => {
    render(<ProgressEmptyState title="Your progression starts here." testID="empty" />);

    expect(screen.getByTestId('empty')).toHaveTextContent('Your progression starts here.');
  });
});
