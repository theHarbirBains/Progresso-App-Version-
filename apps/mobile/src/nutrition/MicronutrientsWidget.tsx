import { AppCard } from '../design/AppCard';
import { ListRow } from '../design/ListRow';

interface Props {
  onPress: () => void;
  testID?: string;
}

/**
 * The Nutrition screen's way to its micronutrients: one quiet row -- an icon, "Micronutrients",
 * "Vitamins, minerals and more" and a chevron. No figures of its own: the screen stays on
 * calories and macros, and the vitamins and minerals are a tap away (MicronutrientsScreen).
 */
export function MicronutrientsWidget({ onPress, testID = 'nutrition-micronutrients' }: Props) {
  return (
    <AppCard testID={testID}>
      <ListRow
        testID={`${testID}-open`}
        icon="droplet"
        title="Micronutrients"
        subtitle="Vitamins, minerals and more"
        onPress={onPress}
        accessibilityLabel="Micronutrients. Vitamins, minerals and more."
      />
    </AppCard>
  );
}
