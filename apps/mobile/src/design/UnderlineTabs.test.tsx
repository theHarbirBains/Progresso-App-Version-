import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { colors } from './theme';
import { UnderlineTabs } from './UnderlineTabs';

const CATEGORIES = [
  { key: 'Workouts' as const, label: 'Workouts', icon: 'list' as const },
  { key: 'Stats' as const, label: 'Stats', icon: 'bar-chart-2' as const },
  { key: 'PRs' as const, label: 'PRs', icon: 'award' as const },
];

describe('UnderlineTabs', () => {
  it('renders every category as its own touch target, evenly dividing the row', () => {
    render(
      <UnderlineTabs
        testID="tabs"
        categories={CATEGORIES}
        active="Workouts"
        onSelect={jest.fn()}
        accentColor="#2F80FF"
      />,
    );

    for (const category of CATEGORIES) {
      const tab = screen.getByTestId(`tabs-${category.key}`);
      expect(tab).toHaveTextContent(new RegExp(category.label));
      expect(StyleSheet.flatten(tab.props.style).flex).toBe(1);
    }
  });

  it('marks the active category as selected and others as not', () => {
    render(
      <UnderlineTabs
        testID="tabs"
        categories={CATEGORIES}
        active="Stats"
        onSelect={jest.fn()}
        accentColor="#2F80FF"
      />,
    );

    expect(screen.getByTestId('tabs-Stats').props.accessibilityState.selected).toBe(true);
    expect(screen.getByTestId('tabs-Workouts').props.accessibilityState.selected).toBe(false);
    expect(screen.getByTestId('tabs-PRs').props.accessibilityState.selected).toBe(false);
  });

  it('calls onSelect with the pressed category', () => {
    const onSelect = jest.fn();
    render(
      <UnderlineTabs
        testID="tabs"
        categories={CATEGORIES}
        active="Workouts"
        onSelect={onSelect}
        accentColor="#2F80FF"
      />,
    );

    fireEvent.press(screen.getByTestId('tabs-PRs'));

    expect(onSelect).toHaveBeenCalledWith('PRs');
  });

  it("colors only the active tab's underline in the accent -- inactive tabs stay transparent", () => {
    render(
      <UnderlineTabs
        testID="tabs"
        categories={CATEGORIES}
        active="Stats"
        onSelect={jest.fn()}
        accentColor="#2F80FF"
      />,
    );

    expect(StyleSheet.flatten(screen.getByTestId('tabs-Stats').props.style).borderBottomColor).toBe(
      '#2F80FF',
    );
    expect(
      StyleSheet.flatten(screen.getByTestId('tabs-Workouts').props.style).borderBottomColor,
    ).toBe('transparent');
    expect(StyleSheet.flatten(screen.getByTestId('tabs-PRs').props.style).borderBottomColor).toBe(
      'transparent',
    );
  });

  it("colors only the active tab's label textPrimary -- inactive labels stay textSecondary", () => {
    render(
      <UnderlineTabs
        testID="tabs"
        categories={CATEGORIES}
        active="PRs"
        onSelect={jest.fn()}
        accentColor="#2F80FF"
      />,
    );

    expect(StyleSheet.flatten(screen.getByText('PRs').props.style).color).toBe(
      colors.textPrimary,
    );
    expect(StyleSheet.flatten(screen.getByText('Workouts').props.style).color).toBe(
      colors.textSecondary,
    );
  });
});
