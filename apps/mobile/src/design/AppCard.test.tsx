import { StyleSheet, Text } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { AppCard, resetNestedCardWarning } from './AppCard';
import { GlassBackground } from './GlassBackground';
import { radii } from './theme';

describe('AppCard', () => {
  it('renders as a plain view when no onPress is given', () => {
    render(
      <AppCard testID="card">
        <Text>Content</Text>
      </AppCard>,
    );

    expect(screen.getByTestId('card')).toBeTruthy();
    expect(screen.getByText('Content')).toBeTruthy();
  });

  it('is pressable and calls onPress when provided', () => {
    const onPress = jest.fn();
    render(
      <AppCard testID="card" onPress={onPress}>
        <Text>Content</Text>
      </AppCard>,
    );

    fireEvent.press(screen.getByTestId('card'));

    expect(onPress).toHaveBeenCalled();
  });

  it('defaults to an accessible button role when pressable, and forwards a given label/state', () => {
    render(
      <AppCard
        testID="card"
        onPress={jest.fn()}
        accessibilityLabel="Start Push workout"
        accessibilityState={{ disabled: true }}
      >
        <Text>Content</Text>
      </AppCard>,
    );

    const card = screen.getByTestId('card');
    expect(card.props.accessibilityRole).toBe('button');
    expect(card.props.accessibilityLabel).toBe('Start Push workout');
    expect(card.props.accessibilityState).toEqual({ disabled: true });
  });
});

describe('AppCard top accent', () => {
  it('draws no accent band by default', () => {
    render(
      <AppCard testID="card">
        <Text>Content</Text>
      </AppCard>,
    );

    expect(screen.queryByTestId('card-top-accent')).toBeNull();
  });

  it('draws a colored band across the top edge when given one', () => {
    render(
      <AppCard testID="card" topAccent="#2F80FF">
        <Text>Content</Text>
      </AppCard>,
    );

    const band = screen.getByTestId('card-top-accent');
    const style = StyleSheet.flatten(band.props.style);
    expect(style.backgroundColor).toBe('#2F80FF');
    expect(style.position).toBe('absolute');
    expect(style.top).toBe(0);
  });
});

describe('AppCard variants and nesting', () => {
  it('draws a glass surface by default, and none for the outline variant', () => {
    const { rerender } = render(
      <AppCard testID="card">
        <Text>Content</Text>
      </AppCard>,
    );
    expect(screen.UNSAFE_queryAllByType(GlassBackground)).toHaveLength(1);

    rerender(
      <AppCard testID="card" variant="outline">
        <Text>Content</Text>
      </AppCard>,
    );
    expect(screen.UNSAFE_queryAllByType(GlassBackground)).toHaveLength(0);
    const style = StyleSheet.flatten(screen.getByTestId('card').props.style);
    expect(style.borderWidth).toBe(1);
  });

  it('uses the surface radius, above the control radius, so buttons nested inside stay concentric', () => {
    render(
      <AppCard testID="card">
        <Text>Content</Text>
      </AppCard>,
    );

    expect(StyleSheet.flatten(screen.getByTestId('card').props.style).borderRadius).toBe(radii.lg);
    expect(radii.lg).toBeGreaterThan(radii.md);
  });

  describe('nested-card warning', () => {
    const originalEnv = process.env.NODE_ENV;
    afterEach(() => {
      process.env.NODE_ENV = originalEnv;
      jest.restoreAllMocks();
    });

    it('warns once, in development, when a card is rendered inside another card', () => {
      process.env.NODE_ENV = 'development';
      resetNestedCardWarning();
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

      render(
        <AppCard>
          <AppCard>
            <Text>Nested</Text>
          </AppCard>
          <AppCard>
            <Text>Nested again</Text>
          </AppCard>
        </AppCard>,
      );

      expect(warn).toHaveBeenCalledTimes(1);
      expect(String(warn.mock.calls[0]?.[0])).toMatch(/inside another AppCard/);
    });

    it('never warns for sibling cards', () => {
      process.env.NODE_ENV = 'development';
      resetNestedCardWarning();
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

      render(
        <>
          <AppCard>
            <Text>A</Text>
          </AppCard>
          <AppCard>
            <Text>B</Text>
          </AppCard>
        </>,
      );

      expect(warn).not.toHaveBeenCalled();
    });

    it('stays silent under test, and still renders the nested card normally', () => {
      resetNestedCardWarning();
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

      render(
        <AppCard>
          <AppCard testID="inner">
            <Text>Nested</Text>
          </AppCard>
        </AppCard>,
      );

      expect(warn).not.toHaveBeenCalled();
      expect(screen.getByTestId('inner')).toBeTruthy();
    });
  });
});
