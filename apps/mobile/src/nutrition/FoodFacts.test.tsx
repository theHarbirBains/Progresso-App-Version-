import { Image, StyleSheet } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { AppCard } from '../design/AppCard';
import { colors, fonts } from '../design/theme';
import { expectNoBareText } from '../testUtils/expectNoBareText';
import { FoodFacts } from './FoodFacts';

const base = {
  name: 'Chicken Breast',
  servingSize: 100,
  servingUnit: 'g',
  calories: 165,
  proteinG: 31 as number | null,
  carbsG: 0 as number | null,
  fatG: 3.6 as number | null,
  showAttribution: false,
  accentColor: '#8B5CF6',
  testIDs: { serving: 's', calories: 'c', protein: 'p', carbs: 'cb', fat: 'f', attribution: 'a' },
};

describe('FoodFacts', () => {
  it('shows the serving, calories and each macro', () => {
    render(<FoodFacts {...base} />);

    expect(screen.getByTestId('s')).toHaveTextContent('Serving: 100 g');
    expect(screen.getByTestId('c')).toHaveTextContent('165 cal');
    expect(screen.getByTestId('p')).toHaveTextContent('31g');
    expect(screen.getByTestId('f')).toHaveTextContent('3.6g');
  });

  it('makes calories the one accent readout and the macros neutral mono readouts', () => {
    render(<FoodFacts {...base} />);

    const calories = StyleSheet.flatten(screen.getByTestId('c').props.style);
    expect(calories.color).toBe('#8B5CF6');
    expect(calories.fontFamily).toBe(fonts.monoBold);
    const protein = StyleSheet.flatten(screen.getByTestId('p').props.style);
    expect(protein.color).toBe(colors.textPrimary);
  });

  it('shows a dash, never a fabricated 0, for a macro the provider did not report', () => {
    render(<FoodFacts {...base} fatG={null} />);

    expect(screen.getByTestId('f')).toHaveTextContent('—');
    expect(screen.getByTestId('f')).not.toHaveTextContent('0');
  });

  it('credits Open Food Facts only when asked', () => {
    const { rerender } = render(<FoodFacts {...base} />);
    expect(screen.queryByTestId('a')).toBeNull();

    rerender(<FoodFacts {...base} showAttribution />);
    expect(screen.getByTestId('a')).toHaveTextContent('Data from Open Food Facts');
  });

  it('is two widgets: a hero (picture, serving, calories) and one for the macros', () => {
    render(<FoodFacts {...base} showAttribution />);

    const cards = screen.UNSAFE_queryAllByType(AppCard);
    expect(cards.map((c) => Boolean(c.props.hero))).toEqual([true, false]);
  });

  it("shows the food's photo when it has one, and a glyph otherwise", () => {
    const { rerender } = render(<FoodFacts {...base} />);
    expect(screen.UNSAFE_queryAllByType(Image)).toHaveLength(0);

    rerender(<FoodFacts {...base} imageUrl="https://images.example/chicken.jpg" />);
    expect(screen.UNSAFE_getByType(Image).props.source).toEqual({
      uri: 'https://images.example/chicken.jpg',
    });
  });

  it('renders no bare text', () => {
    render(<FoodFacts {...base} showAttribution />);

    expectNoBareText();
  });
});
