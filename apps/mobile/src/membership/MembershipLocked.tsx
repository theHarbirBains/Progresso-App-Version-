import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Card } from '../design/Card';
import { EmptyState } from '../design/EmptyState';
import { colors } from '../design/theme';
import type { RootStackParamList } from '../navigation/types';

interface Props {
  /** What's locked: "Nutrition". */
  part: string;
  /** The memberships that include it: "Workouts + Nutrition and Everything". */
  includedIn: string;
  testID?: string;
}

/**
 * In place of a part of the app the person's membership leaves out: what it is part of, and a
 * way to change membership -- free, any time. Never a broken or empty page.
 */
export function MembershipLocked({ part, includedIn, testID }: Props) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  return (
    <Card testID={testID}>
      <EmptyState
        icon={<Feather name="lock" size={28} color={colors.textSecondary} />}
        title={`${part} isn't in your membership`}
        description={`It's part of ${includedIn}. Memberships are free -- change yours any time.`}
        action={{
          label: 'Change Membership',
          onPress: () => navigation.navigate('SettingsMembership'),
          testID: testID ? `${testID}-change` : undefined,
        }}
      />
    </Card>
  );
}
