import { useEffect, useRef } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Image,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { welcomeStyles as styles } from './welcomeStyles';

const logo = require('../../assets/progresso-mark.png');

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
// requires a new database field). Purely introductory; tapping Get Started
// hands off to the app's existing Dashboard-first navigator unchanged.
export function WelcomeScreen({ onGetStarted }: Props) {
  const insets = useSafeAreaInsets();
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const contentTranslateY = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then((reduceMotion) => {
      if (reduceMotion) {
        contentOpacity.setValue(1);
        contentTranslateY.setValue(0);
        return;
      }
      Animated.parallel([
        Animated.timing(contentOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(contentTranslateY, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]).start();
    });
  }, [contentOpacity, contentTranslateY]);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 },
      ]}
    >
      <Animated.View
        style={{ opacity: contentOpacity, transform: [{ translateY: contentTranslateY }] }}
      >
        <View style={styles.header}>
          <Image source={logo} style={styles.logo} resizeMode="contain" />
          <Text style={styles.title}>Welcome to Progresso</Text>
          <Text style={styles.subtitle}>Your training and nutrition, in one place.</Text>
        </View>

        <View style={styles.features}>
          {FEATURES.map((feature) => (
            <View key={feature.icon} style={styles.featureRow}>
              <View style={styles.featureIcon}>
                <Feather name={feature.icon} size={18} color="#FFFFFF" />
              </View>
              <Text style={styles.featureText}>{feature.text}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity
          testID="welcome-get-started"
          style={styles.button}
          onPress={onGetStarted}
          accessibilityRole="button"
        >
          <Text style={styles.buttonText}>Get Started</Text>
        </TouchableOpacity>
      </Animated.View>
    </ScrollView>
  );
}
