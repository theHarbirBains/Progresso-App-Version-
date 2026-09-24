import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from './Text';
import { colors, fonts, typeScale } from './theme';

interface Props {
  /** Every letter to display, in display order (e.g. ALPHABET_INDEX_LETTERS from foodLibraryGrouping.ts). */
  letters: string[];
  /** Letters that actually have content -- tappable and shown at full emphasis; the rest render dimmed and inert. */
  availableLetters: Set<string>;
  /** The letter of whichever section is currently in view, highlighted in `accentColor`. */
  activeLetter?: string;
  onSelect: (letter: string) => void;
  accentColor: string;
  testID?: string;
}

/**
 * A vertical, tap-to-jump A-Z index (the iOS Contacts-style rail) -- each
 * letter is its own small touch target rather than a single drag-scrub
 * surface, which keeps this simply testable via a normal `press` and still
 * delivers the core "jump to a letter" behavior. Purely a controlled
 * presentational list: the caller (FoodLibraryScreen) owns what "select"
 * means (scrolling a SectionList to that section).
 */
export function AlphabetIndexRail({
  letters,
  availableLetters,
  activeLetter,
  onSelect,
  accentColor,
  testID,
}: Props) {
  return (
    <View testID={testID} style={styles.rail} pointerEvents="box-none">
      {letters.map((letter) => {
        const available = availableLetters.has(letter);
        const active = available && letter === activeLetter;
        return (
          <TouchableOpacity
            key={letter}
            testID={testID ? `${testID}-${letter}` : undefined}
            style={styles.item}
            onPress={() => available && onSelect(letter)}
            disabled={!available}
            hitSlop={{ top: 2, bottom: 2, left: 6, right: 6 }}
            accessibilityRole="button"
            accessibilityLabel={`Jump to ${letter}`}
            accessibilityState={{ disabled: !available, selected: active }}
          >
            <Text
              style={[
                styles.letter,
                { color: available ? colors.textSecondary : colors.textMuted },
                active && { color: accentColor, fontFamily: fonts.display },
              ]}
            >
              {letter}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  rail: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  item: {
    paddingVertical: 1,
    paddingHorizontal: 4,
  },
  letter: {
    ...typeScale.caption,
    fontFamily: fonts.semibold,
  },
});
