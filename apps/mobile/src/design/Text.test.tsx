import { createRef } from 'react';
import { StyleSheet, Text as RNText } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { Text, resolveTextStyle } from './Text';
import { fonts, typeScale } from './theme';

function styleOf(testID: string) {
  return StyleSheet.flatten(screen.getByTestId(testID).props.style) as Record<string, unknown>;
}

describe('Text', () => {
  it('renders body text in Manrope Regular when no family or weight is given', () => {
    render(<Text testID="t">Hello</Text>);

    expect(styleOf('t').fontFamily).toBe(fonts.body);
  });

  it.each([
    ['400', fonts.body],
    ['normal', fonts.body],
    ['500', fonts.displayMedium],
    ['600', fonts.semibold],
    ['700', fonts.display],
    ['bold', fonts.display],
    ['800', fonts.displayHeavy],
    ['900', fonts.displayHeavy],
  ] as const)('maps fontWeight %s to the matching Manrope face', (weight, family) => {
    render(
      <Text testID="t" style={{ fontWeight: weight, fontSize: 14 }}>
        Hello
      </Text>,
    );

    const style = styleOf('t');
    expect(style.fontFamily).toBe(family);
    expect(style.fontSize).toBe(14);
  });

  it('drops fontWeight once a family is chosen, so the OS never synthesizes bold on top of a bold face', () => {
    render(
      <Text testID="t" style={{ fontWeight: '700' }}>
        Hello
      </Text>,
    );

    expect(styleOf('t').fontWeight).toBeUndefined();
  });

  it('leaves an explicit fontFamily completely alone (mono readouts, type tokens)', () => {
    render(
      <Text testID="t" style={{ fontFamily: fonts.monoBold, fontWeight: '700' }}>
        42
      </Text>,
    );

    const style = styleOf('t');
    expect(style.fontFamily).toBe(fonts.monoBold);
    expect(style.fontWeight).toBe('700');
  });

  it('keeps the caller style array intact, appending only its override', () => {
    const a = { color: '#fff' };
    const b = { fontSize: 20 };

    const resolved = resolveTextStyle([a, b]) as unknown[];

    expect(resolved.slice(0, 2)).toEqual([a, b]);
    expect(resolved).toHaveLength(3);
  });

  it('does not reset a nested, unstyled Text to Regular -- it keeps inheriting its parent face', () => {
    render(
      <Text testID="parent" style={{ fontWeight: '700' }}>
        Bold sentence <Text testID="child">span</Text>
      </Text>,
    );

    expect(styleOf('parent').fontFamily).toBe(fonts.display);
    // No family forced on the child: RN inherits the parent's face.
    expect(screen.getByTestId('child').props.style).toBeUndefined();
  });

  it('still resolves a nested Text that sets its own weight', () => {
    render(
      <Text testID="parent">
        Regular{' '}
        <Text testID="child" style={{ fontWeight: '700' }}>
          bold
        </Text>
      </Text>,
    );

    expect(styleOf('child').fontFamily).toBe(fonts.display);
  });

  it('forwards props and the ref to the underlying react-native Text', () => {
    const ref = createRef<React.ComponentRef<typeof RNText>>();

    render(
      <Text ref={ref} testID="t" numberOfLines={1} accessibilityRole="header">
        Title
      </Text>,
    );

    expect(ref.current).toBeTruthy();
    expect(screen.getByTestId('t').props.numberOfLines).toBe(1);
    expect(screen.getByTestId('t').props.accessibilityRole).toBe('header');
    expect(screen.getByText('Title')).toBeTruthy();
  });
});

describe('type scale', () => {
  it('gives every token an explicit font family, so no text can fall back to the system font', () => {
    for (const [name, token] of Object.entries(typeScale)) {
      expect({ name, family: token.fontFamily }).toEqual({
        name,
        family: expect.any(String),
      });
    }
  });

  it('uses JetBrains Mono only for the numeric readout tokens', () => {
    const mono = Object.entries(typeScale)
      .filter(([, token]) => token.fontFamily.startsWith('JetBrainsMono'))
      .map(([name]) => name)
      .sort();

    expect(mono).toEqual(['statLarge', 'statMedium', 'statSmall']);
  });
});
