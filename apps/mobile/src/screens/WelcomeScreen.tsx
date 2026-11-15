import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { Avatar } from '../design/Avatar';
import { PrimaryButton, SecondaryButton, TextButton } from '../design/Button';
import { Text } from '../design/Text';
import { colors, radii, spacing } from '../design/theme';
import { useNutritionGoals } from '../nutrition/NutritionGoalsProvider';
import { useProfile } from '../profile/ProfileProvider';
import { useAvatarPhoto } from '../profile/useAvatarPhoto';
import { ContactSuggestions } from '../social/ContactSuggestions';
import { useAppTheme } from '../theme/appThemeContext';
import { AuthFrame } from './AuthFrame';
import { authStyles } from './authStyles';

type Step = 'photo' | 'friends';

/**
 * A new account's welcome, right after onboarding's answers are saved (App.tsx shows it in place
 * of the app, onboarding/welcomeStage.ts): a profile photo, then the people in their contacts
 * already on Progresso, to follow -- each skippable. It first reads the profile and daily targets
 * again, so the app opens on everything onboarding just saved.
 */
export function WelcomeScreen({ onDone }: { onDone: () => void }) {
  const { user } = useAuth();
  const { profile, refetch: refetchProfile } = useProfile();
  const { refetch: refetchGoals } = useNutritionGoals();
  const { accent } = useAppTheme();
  const avatar = useAvatarPhoto(user?.id);
  const [step, setStep] = useState<Step>('photo');

  useEffect(() => {
    void refetchProfile();
    void refetchGoals();
    // Once, as the welcome opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (step === 'friends') {
    return (
      <AuthFrame
        title="Find your friends"
        subtitle="See who from your contacts is already on Progresso, and follow them. Their workouts show in your Friends feed."
      >
        <View testID="welcome-friends" style={styles.friends}>
          {/* Their profiles open from Find People, once in the app. */}
          <ContactSuggestions onOpen={() => undefined} />
        </View>
        <PrimaryButton
          testID="welcome-done"
          label="Done"
          onPress={onDone}
          accentColor={accent.accent}
          onAccentColor={accent.onAccent}
        />
      </AuthFrame>
    );
  }

  const hasPhoto = Boolean(profile?.avatarUrl);
  const initial = (profile?.displayName ?? profile?.username ?? '').charAt(0).toUpperCase();
  return (
    <AuthFrame
      title="Add a profile photo"
      subtitle="Friends see it on your profile, your workouts and your comments."
    >
      <View testID="welcome-photo" style={styles.photo}>
        <View style={[styles.ring, { borderColor: accent.accent }]}>
          {avatar.saving ? (
            <View style={styles.saving}>
              <ActivityIndicator testID="welcome-photo-saving" color={accent.accent} />
            </View>
          ) : (
            <Avatar
              uri={profile?.avatarUrl}
              initial={initial || null}
              size={112}
              iconSize={44}
              iconColor={colors.textSecondary}
            />
          )}
        </View>
      </View>
      {avatar.error ? (
        <Text testID="welcome-photo-error" style={authStyles.errorText}>
          {avatar.error}
        </Text>
      ) : null}
      {hasPhoto ? (
        <>
          <PrimaryButton
            testID="welcome-photo-continue"
            label="Continue"
            onPress={() => setStep('friends')}
            disabled={avatar.saving}
            accentColor={accent.accent}
            onAccentColor={accent.onAccent}
          />
          <SecondaryButton
            testID="welcome-photo-change"
            label="Change Photo"
            onPress={() => void avatar.choosePhoto()}
            disabled={avatar.saving}
          />
        </>
      ) : (
        <>
          <PrimaryButton
            testID="welcome-photo-choose"
            label="Choose Photo"
            onPress={() => void avatar.choosePhoto()}
            loading={avatar.saving}
            accentColor={accent.accent}
            onAccentColor={accent.onAccent}
          />
          <TextButton
            testID="welcome-photo-skip"
            label="Skip for now"
            onPress={() => setStep('friends')}
            disabled={avatar.saving}
          />
        </>
      )}
    </AuthFrame>
  );
}

const styles = StyleSheet.create({
  photo: {
    alignItems: 'center',
  },
  ring: {
    borderWidth: 3,
    borderRadius: radii.pill,
    padding: 3,
  },
  saving: {
    width: 112,
    height: 112,
    alignItems: 'center',
    justifyContent: 'center',
  },
  friends: {
    gap: spacing.md,
  },
});
