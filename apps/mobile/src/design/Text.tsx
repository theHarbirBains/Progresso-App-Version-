import { createContext, forwardRef, useContext, type ComponentRef } from 'react';
import { StyleSheet, Text as RNText, type TextProps, type TextStyle } from 'react-native';
import { fonts } from './theme';

// The one Text primitive for the whole app. It is a drop-in replacement for
// react-native's Text (same props, same ref) whose only job is to make sure
// every string renders in Manrope -- React Native has no global default
// font, so without this any Text that doesn't spell out a fontFamily falls
// back to the platform system font, which is how the app ended up with two
// competing sans-serifs.
//
// Resolution rules, in order:
//   1. A style that already names a fontFamily is left alone (the mono
//      readouts, the typeScale tokens, anything explicit).
//   2. Otherwise the style's `fontWeight` picks the matching Manrope face
//      (see WEIGHT_FAMILY) and the `fontWeight` itself is dropped -- with a
//      custom family, keeping it would ask the OS to synthesize bold on top
//      of a face that is already bold.
//   3. No family and no weight means body text: Manrope Regular.
//
// A Text nested inside another Text with neither a family nor a weight of
// its own is left completely alone, so it keeps inheriting its parent's face
// instead of being reset to Regular (e.g. an unstyled span inside a bold
// sentence stays bold).

const WEIGHT_FAMILY: Record<string, string> = {
  '100': fonts.body,
  '200': fonts.body,
  '300': fonts.body,
  '400': fonts.body,
  normal: fonts.body,
  '500': fonts.displayMedium,
  '600': fonts.semibold,
  '700': fonts.display,
  bold: fonts.display,
  '800': fonts.displayHeavy,
  '900': fonts.displayHeavy,
};

const NestedTextContext = createContext(false);

/** Exported for tests and for the rare non-`Text` consumer (e.g. a TextInput) that needs the same resolution. */
export function resolveTextStyle(style: TextProps['style'], nested = false): TextProps['style'] {
  const flat = (StyleSheet.flatten(style) ?? {}) as TextStyle;
  if (flat.fontFamily) return style;

  const weight = flat.fontWeight === undefined ? undefined : String(flat.fontWeight);
  if (nested && weight === undefined) return style;

  const family = weight === undefined ? fonts.body : (WEIGHT_FAMILY[weight] ?? fonts.body);
  // The caller's style is passed through untouched (its array shape included)
  // with one override appended: the resolved family, and an explicit
  // `fontWeight: undefined` -- a later `undefined` wins in RN's style
  // flattening, so the weight is dropped without rewriting the caller's own
  // style objects.
  const override: TextStyle = { fontFamily: family, fontWeight: undefined };
  return Array.isArray(style) ? [...style, override] : [style, override];
}

export const Text = forwardRef<ComponentRef<typeof RNText>, TextProps>(function Text(
  { style, children, ...rest },
  ref,
) {
  const nested = useContext(NestedTextContext);
  return (
    <NestedTextContext.Provider value={true}>
      <RNText ref={ref} style={resolveTextStyle(style, nested)} {...rest}>
        {children}
      </RNText>
    </NestedTextContext.Provider>
  );
});
