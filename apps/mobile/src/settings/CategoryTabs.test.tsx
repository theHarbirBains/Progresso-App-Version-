import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { resolveTextStyle } from '../design/Text';
import { CategoryTabs } from './CategoryTabs';
import { SETTINGS_CATEGORIES } from './settingsCategories';
import { settingsStyles } from './settingsStyles';

/** Every layout-affecting property a selected pill must never diverge on from its own unselected size. */
const LAYOUT_KEYS = [
  'paddingHorizontal',
  'paddingVertical',
  'borderRadius',
  'borderWidth',
] as const;
// `fontFamily` is included since Text now expresses weight through the font
// family (see design/Text.tsx) -- a selected pill switching to a bolder
// family would widen it exactly like the old fontWeight change did.
const TEXT_LAYOUT_KEYS = ['fontSize', 'fontWeight', 'fontFamily'] as const;

const baselinePillStyle = StyleSheet.flatten(settingsStyles.tab) as Record<string, unknown>;
// The label's baseline is its style *as Text resolves it* (weight -> family),
// which is what actually renders -- comparing against the raw style would
// only re-test Text's own font resolution, not selection stability.
const baselineLabelStyle = StyleSheet.flatten(resolveTextStyle(settingsStyles.tabLabel)) as Record<
  string,
  unknown
>;

describe('CategoryTabs', () => {
  it('renders every category as its own touch target', () => {
    render(
      <CategoryTabs
        testID="tabs"
        categories={[...SETTINGS_CATEGORIES]}
        active="Account"
        onSelect={jest.fn()}
        accentColor="#2F80FF"
      />,
    );

    for (const category of SETTINGS_CATEGORIES) {
      expect(screen.getByTestId(`tabs-${category.key}`)).toHaveTextContent(category.label);
    }
  });

  it('marks the active category as selected and others as not', () => {
    render(
      <CategoryTabs
        testID="tabs"
        categories={[...SETTINGS_CATEGORIES]}
        active="Appearance"
        onSelect={jest.fn()}
        accentColor="#2F80FF"
      />,
    );

    expect(screen.getByTestId('tabs-Appearance').props.accessibilityState.selected).toBe(true);
    expect(screen.getByTestId('tabs-Account').props.accessibilityState.selected).toBe(false);
  });

  it('calls onSelect with the pressed category', () => {
    const onSelect = jest.fn();
    render(
      <CategoryTabs
        testID="tabs"
        categories={[...SETTINGS_CATEGORIES]}
        active="Account"
        onSelect={onSelect}
        accentColor="#2F80FF"
      />,
    );

    fireEvent.press(screen.getByTestId('tabs-Notifications'));

    expect(onSelect).toHaveBeenCalledWith('Notifications');
  });

  // Regression coverage: the selected pill previously went bold (fontWeight
  // 700 vs. 600) while unselected, which visibly widened it since each pill
  // sizes itself to its own label -- selection must only ever change color.
  it.each(SETTINGS_CATEGORIES.map((c) => c.key))(
    'gives the selected pill (%s) identical layout to its own unselected size',
    (activeKey) => {
      render(
        <CategoryTabs
          testID="tabs"
          categories={[...SETTINGS_CATEGORIES]}
          active={activeKey}
          onSelect={jest.fn()}
          accentColor="#2F80FF"
        />,
      );

      const pillStyle = StyleSheet.flatten(
        screen.getByTestId(`tabs-${activeKey}`).props.style,
      ) as Record<string, unknown>;
      const label = SETTINGS_CATEGORIES.find((c) => c.key === activeKey)!.label;
      const labelStyle = StyleSheet.flatten(screen.getByText(label).props.style) as Record<
        string,
        unknown
      >;

      for (const key of LAYOUT_KEYS) {
        expect(pillStyle[key]).toBe(baselinePillStyle[key]);
      }
      for (const key of TEXT_LAYOUT_KEYS) {
        expect(labelStyle[key]).toBe(baselineLabelStyle[key]);
      }
    },
  );

  it('every unselected pill also matches the baseline layout exactly', () => {
    render(
      <CategoryTabs
        testID="tabs"
        categories={[...SETTINGS_CATEGORIES]}
        active="Account"
        onSelect={jest.fn()}
        accentColor="#2F80FF"
      />,
    );

    for (const category of SETTINGS_CATEGORIES.filter((c) => c.key !== 'Account')) {
      const pillStyle = StyleSheet.flatten(
        screen.getByTestId(`tabs-${category.key}`).props.style,
      ) as Record<string, unknown>;
      const labelStyle = StyleSheet.flatten(screen.getByText(category.label).props.style) as Record<
        string,
        unknown
      >;

      for (const key of LAYOUT_KEYS) {
        expect(pillStyle[key]).toBe(baselinePillStyle[key]);
      }
      for (const key of TEXT_LAYOUT_KEYS) {
        expect(labelStyle[key]).toBe(baselineLabelStyle[key]);
      }
    }
  });

  // Regression coverage: without an explicit flexGrow: 0, this ScrollView
  // falls back to React Native's own default (flexGrow: 1) and competes
  // with the content area below it for leftover vertical space on any
  // screen with short content -- stretching every pill into a tall oval
  // (alignItems defaults to 'stretch' on a flex row's cross-axis) even
  // though each pill's own declared height never changed.
  it('never grows the tab bar itself, and never stretches a pill to fill it', () => {
    render(
      <CategoryTabs
        testID="tabs"
        categories={[...SETTINGS_CATEGORIES]}
        active="Account"
        onSelect={jest.fn()}
        accentColor="#2F80FF"
      />,
    );

    const scrollStyle = StyleSheet.flatten(screen.getByTestId('tabs').props.style) as Record<
      string,
      unknown
    >;
    expect(scrollStyle.flexGrow).toBe(0);

    const rowStyle = StyleSheet.flatten(settingsStyles.tabsRow) as Record<string, unknown>;
    expect(rowStyle.alignItems).toBe('center');
  });
});
