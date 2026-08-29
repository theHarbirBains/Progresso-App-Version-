import { render, screen } from '@testing-library/react-native';
import { StatValue } from './StatValue';

describe('StatValue', () => {
  it('renders the value and an optional unit together', () => {
    render(<StatValue testID="stat" value="110" unit="kg" />);

    expect(screen.getByTestId('stat')).toHaveTextContent('110kg');
  });

  it('renders the value alone when no unit is given', () => {
    render(<StatValue testID="stat" value="1,840" />);

    expect(screen.getByTestId('stat')).toHaveTextContent('1,840');
  });
});
