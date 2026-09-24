import { View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { PrimaryButton } from '../design/Button';
import { ListRow } from '../design/ListRow';
import { AuthFrame } from './AuthFrame';
import { authStyles as styles } from './authStyles';

interface Props {
  onGetStarted: () => void;
}

interface Feature {
  icon: keyof typeof Feather.glyphMap;
  text: string;
}

const FEATURES: Feature[] = [
  { icon: 'activity', text: 'Track workouts and progressive overload' },
  { icon: 'trending-up', text: 'Monitor your progress and PRs' },
  { icon: 'pie-chart', text: 'Log nutrition and manage daily goals' },
];

// Shown once, immediately after a successful account creation (see
// App.tsx's Root -- `justCreatedAccount` is plain in-memory React state,
// never persisted, so this never re-appears for a returning user and never
// requires a new database field). Purely introductory: three plain rows and
// the one filled Get Started, which hands off to the app's existing
// Dashboard-first navigator unchanged.
export function WelcomeScreen({ onGetStarted }: Props) {
  return (
    <AuthFrame
      showLogo
      title="Welcome to Progresso"
      subtitle="Your training and nutrition, in one place."
    >
      <View>
        {FEATURES.map((feature, index) => (
          <ListRow
            key={feature.icon}
            icon={feature.icon}
            title={feature.text}
            divider={index > 0}
          />
        ))}
      </View>

      <View style={styles.actions}>
        <PrimaryButton testID="welcome-get-started" label="Get Started" onPress={onGetStarted} />
      </View>
    </AuthFrame>
  );
}
