import { View } from 'react-native';
import { BottomSheet } from '../../design/BottomSheet';
import { PrimaryButton, TextButton } from '../../design/Button';
import { SegmentedControl } from '../../design/SegmentedControl';
import { Text } from '../../design/Text';
import { micronutrientsStyles as styles } from '../../screens/micronutrientsStyles';
import {
  lifeStageApplies,
  type LifeStage,
  type ReferenceChoices,
  type ReferencePerson,
  type ReferenceSex,
} from './referenceValues';

interface Props {
  visible: boolean;
  person: ReferencePerson;
  /** Whether the sex category comes from the profile's gender (male or female) -- then it isn't asked. */
  sexFromProfile: boolean;
  choices: ReferenceChoices;
  onChange: (choices: ReferenceChoices) => void;
  /** Edit Profile, for the birthday. */
  onEditProfile: () => void;
  onClose: () => void;
  accentColor: string;
  onAccentColor: string;
}

const SEX_OPTIONS: { label: string; value: ReferenceSex }[] = [
  { label: 'Female', value: 'female' },
  { label: 'Male', value: 'male' },
];
const STAGE_OPTIONS: { label: string; value: LifeStage | 'none' }[] = [
  { label: 'Neither', value: 'none' },
  { label: 'Pregnant', value: 'pregnant' },
  { label: 'Breastfeeding', value: 'breastfeeding' },
];

/**
 * Which of Health Canada's reference values apply: by age (from the birthday in the profile), by
 * the sex categories its tables use (from the profile's gender, or chosen here when it's neither),
 * and pregnancy or breastfeeding (asked only where the tables have them: female, 14 to 50).
 * What's chosen here stays on the phone.
 */
export function ReferenceSheet({
  visible,
  person,
  sexFromProfile,
  choices,
  onChange,
  onEditProfile,
  onClose,
  accentColor,
  onAccentColor,
}: Props) {
  return (
    <BottomSheet visible={visible} onClose={onClose} testID="micronutrients-reference-sheet">
      <View style={styles.sheetBody}>
        <Text style={styles.cardTitle}>Your Recommendations</Text>
        <Text style={styles.body}>
          Progresso uses Health Canada’s Dietary Reference Intakes. They’re set by age, by sex and
          for pregnancy and breastfeeding — your weight and activity don’t change them.
        </Text>

        <View style={styles.sectionGap}>
          <Text style={styles.rowCaption}>Age</Text>
          {person.ageYears !== null ? (
            <Text testID="micronutrients-reference-age" style={styles.body}>
              {person.ageYears}, from the birthday in your profile
            </Text>
          ) : (
            <Text testID="micronutrients-reference-age" style={styles.body}>
              Add your birthday to your profile to see the values for your age.
            </Text>
          )}
          <TextButton
            testID="micronutrients-reference-edit-profile"
            label={person.ageYears !== null ? 'Edit Profile' : 'Add Birthday'}
            onPress={onEditProfile}
          />
        </View>

        <View style={styles.sectionGap}>
          <Text style={styles.rowCaption}>Reference values</Text>
          {sexFromProfile ? (
            <Text testID="micronutrients-reference-sex" style={styles.body}>
              {person.sex === 'female' ? 'Female' : 'Male'}, from your profile
            </Text>
          ) : (
            <>
              <Text style={styles.quiet}>
                Health Canada’s tables have female and male values. Choose the ones to use.
              </Text>
              <SegmentedControl
                testID="micronutrients-reference-sex"
                options={SEX_OPTIONS}
                value={choices.sex ?? null}
                onChange={(sex) => onChange({ ...choices, sex })}
                accentColor={accentColor}
                onAccentColor={onAccentColor}
              />
            </>
          )}
        </View>

        {lifeStageApplies(person) ? (
          <View style={styles.sectionGap}>
            <Text style={styles.rowCaption}>Pregnant or breastfeeding?</Text>
            <SegmentedControl
              testID="micronutrients-reference-stage"
              options={STAGE_OPTIONS}
              value={choices.lifeStage ?? 'none'}
              onChange={(stage) =>
                onChange({ ...choices, lifeStage: stage === 'none' ? null : stage })
              }
              accentColor={accentColor}
              onAccentColor={onAccentColor}
            />
          </View>
        ) : null}

        <Text style={styles.quiet}>Kept on this phone only — never added to your account.</Text>
        <PrimaryButton
          testID="micronutrients-reference-done"
          label="Done"
          onPress={onClose}
          accentColor={accentColor}
          onAccentColor={onAccentColor}
        />
      </View>
    </BottomSheet>
  );
}
