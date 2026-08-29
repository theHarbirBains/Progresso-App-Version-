import { render, screen } from '@testing-library/react-native';
import { Badge } from './Badge';

describe('Badge', () => {
  it('renders its label', () => {
    render(<Badge testID="badge" label="8 Rep PR" />);

    expect(screen.getByTestId('badge')).toHaveTextContent('8 Rep PR');
  });
});
