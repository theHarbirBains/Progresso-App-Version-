import { FlatList } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { CountryStep } from './CountryStep';

function listedCodes(): string[] {
  const list = screen.UNSAFE_getByType(FlatList);
  return (list.props.data as { code: string }[]).map((country) => country.code);
}

describe('CountryStep', () => {
  it('lists every country alphabetically', () => {
    render(<CountryStep testID="country" value={null} onChange={jest.fn()} />);

    expect(listedCodes().slice(0, 3)).toEqual(['AF', 'AL', 'DZ']);
    expect(screen.queryByTestId('country-located')).toBeNull();
  });

  it('puts the country the phone is in first, marked as your location', () => {
    const onChange = jest.fn();
    render(<CountryStep testID="country" value={null} onChange={onChange} located="CA" />);

    const codes = listedCodes();
    expect(codes[0]).toBe('CA');
    expect(codes.filter((code) => code === 'CA')).toHaveLength(1);
    expect(screen.getByTestId('country-option-CA')).toHaveTextContent(/Canada.*Your location/);

    fireEvent.press(screen.getByTestId('country-option-CA'));
    expect(onChange).toHaveBeenCalledWith('CA');
  });

  it('keeps it first while it matches the search', () => {
    render(<CountryStep testID="country" value={null} onChange={jest.fn()} located="CA" />);

    fireEvent.changeText(screen.getByTestId('country-search'), 'ca');
    expect(listedCodes()[0]).toBe('CA');

    fireEvent.changeText(screen.getByTestId('country-search'), 'France');
    expect(listedCodes()).toEqual(['FR']);
  });
});
