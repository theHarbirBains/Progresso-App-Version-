import { useCallback, useRef } from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import { colors, fonts, radii, spacing } from '../design/theme';

const ITEM_HEIGHT = 44;
const VISIBLE_ITEMS = 5;
const CONTAINER_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;

interface Props {
  testID: string;
  /** Values are shown in this exact order; `selectedValue` must be one of them. */
  values: string[];
  selectedValue: string;
  onChange: (value: string) => void;
}

/**
 * A single reusable scroll-snap wheel column -- the shared primitive behind
 * DateWheelPicker (month/day/year), WeightWheelPicker, and HeightWheelPicker.
 * Deliberately a plain FlatList with snapping rather than a native picker
 * dependency: no wheel-picker library exists in this project yet, and this
 * gives full control over styling to match the app's theme (see the
 * onboarding architecture inspection/approval).
 */
export function WheelPicker({ testID, values, selectedValue, onChange }: Props) {
  const listRef = useRef<FlatList<string>>(null);
  const selectedIndex = Math.max(0, values.indexOf(selectedValue));

  const handleMomentumEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const rawIndex = event.nativeEvent.contentOffset.y / ITEM_HEIGHT;
      const index = Math.min(values.length - 1, Math.max(0, Math.round(rawIndex)));
      const value = values[index];
      if (value !== undefined && value !== selectedValue) {
        onChange(value);
      }
    },
    [values, selectedValue, onChange],
  );

  return (
    <View testID={testID} style={styles.container}>
      <View pointerEvents="none" style={styles.highlight} />
      <FlatList
        ref={listRef}
        data={values}
        keyExtractor={(value) => value}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        getItemLayout={(_, index) => ({
          length: ITEM_HEIGHT,
          offset: ITEM_HEIGHT * index,
          index,
        })}
        initialScrollIndex={selectedIndex}
        contentContainerStyle={{
          paddingVertical: (CONTAINER_HEIGHT - ITEM_HEIGHT) / 2,
        }}
        onMomentumScrollEnd={handleMomentumEnd}
        renderItem={({ item }) => (
          <TouchableOpacity
            testID={`${testID}-item-${item}`}
            style={styles.item}
            activeOpacity={0.7}
            onPress={() => {
              if (item !== selectedValue) onChange(item);
            }}
          >
            <Text style={[styles.itemText, item === selectedValue && styles.itemTextSelected]}>
              {item}
            </Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: CONTAINER_HEIGHT,
    width: '100%',
    justifyContent: 'center',
  },
  highlight: {
    position: 'absolute',
    top: (CONTAINER_HEIGHT - ITEM_HEIGHT) / 2,
    left: 0,
    right: 0,
    height: ITEM_HEIGHT,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
  },
  item: {
    height: ITEM_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemText: {
    color: colors.textMuted,
    fontSize: 17,
    fontFamily: fonts.mono,
    paddingHorizontal: spacing.md,
  },
  itemTextSelected: {
    color: colors.textPrimary,
    fontFamily: fonts.monoBold,
  },
});
