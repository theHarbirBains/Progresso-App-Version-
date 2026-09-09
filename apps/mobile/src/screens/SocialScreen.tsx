import { useCallback, useEffect, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthProvider';
import { BottomNavBar, EmptyState, LoadingState, SectionHeader } from '../design';
import { AppCard } from '../design/AppCard';
import { QuickActionMenu } from '../design/QuickActionMenu';
import { colors, spacing, typeScale } from '../design/theme';
import { greetingName } from '../dashboard/greeting';
import { getMyProfile, type ProfileResponse } from '../lib/api';
import type { RootStackScreenProps } from '../navigation/types';
import { useQuickActions } from '../navigation/useQuickActions';
import { useProgressTheme } from '../progress/useProgressTheme';
import { dashboardStyles } from './dashboardStyles';

type Props = RootStackScreenProps<'Social'>;

// Front-end only, per the approved scope: no social backend exists yet
// (no posts, follows, activity feed). "Your Profile" links to the existing
// AccountSettingsScreen -- the one already-real piece of "profile" this app
// has -- and "Recent Activity" is an honest empty state rather than
// fabricated posts.
export function SocialScreen({ navigation }: Props) {
  const { session } = useAuth();
  const accessToken = session?.access_token;
  const { theme, themeLoading } = useProgressTheme();
  const insets = useSafeAreaInsets();
  const quickActions = useQuickActions(navigation);

  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setProfileError(null);
    try {
      setProfile(await getMyProfile(accessToken));
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    load();
    const unsubscribe = navigation.addListener('focus', load);
    return unsubscribe;
  }, [navigation, load]);

  if (loading || themeLoading) {
    return <LoadingState testID="social-loading" />;
  }

  const name = greetingName(profile?.displayName, profile?.username);
  const avatarInitial = name ? name.charAt(0).toUpperCase() : null;

  return (
    <View style={[dashboardStyles.screen, { paddingTop: insets.top }]}>
      <ScrollView
        testID="social-scroll"
        contentContainerStyle={{
          paddingHorizontal: spacing.xxl,
          paddingTop: spacing.lg,
          paddingBottom: 90 + insets.bottom,
        }}
      >
        <Text style={[typeScale.screenTitle, { color: colors.textPrimary }]}>Social</Text>
        <Text
          style={{
            color: colors.textSecondary,
            fontSize: 14,
            marginTop: 4,
            marginBottom: spacing.xxl,
          }}
        >
          Train together. Progress together.
        </Text>

        {profileError ? (
          <Text testID="social-profile-error" style={dashboardStyles.errorText}>
            {profileError}
          </Text>
        ) : null}

        <View style={{ marginBottom: spacing.xxl }}>
          <SectionHeader label="Your Profile" />
          <AppCard testID="social-profile-card">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <View
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 28,
                  backgroundColor: theme.accentBg,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {avatarInitial ? (
                  <Text style={{ ...typeScale.cardTitle, color: theme.accent, fontSize: 22 }}>
                    {avatarInitial}
                  </Text>
                ) : (
                  <Feather name="user" size={22} color={theme.accent} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '700' }}>
                  {name ?? 'Your Profile'}
                </Text>
                {profile?.username ? (
                  <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 2 }}>
                    @{profile.username}
                  </Text>
                ) : null}
              </View>
            </View>
            <TouchableOpacity
              testID="social-view-profile"
              style={{ marginTop: spacing.lg, alignItems: 'center' }}
              onPress={() => navigation.navigate('AccountSettings')}
              accessibilityRole="button"
            >
              <Text style={{ color: theme.accent, fontSize: 14, fontWeight: '700' }}>
                View Profile
              </Text>
            </TouchableOpacity>
          </AppCard>
        </View>

        <View>
          <SectionHeader label="Recent Activity" />
          <AppCard>
            <EmptyState
              testID="social-activity-empty"
              icon={<Feather name="activity" size={24} color={colors.textMuted} />}
              title="Your fitness story starts here."
            />
          </AppCard>
        </View>
      </ScrollView>

      <BottomNavBar
        testID="social-bottom-bar"
        active="social"
        accentColor={theme.accent}
        onAccentColor={theme.onAccent}
        paddingBottom={Math.max(insets.bottom, 8)}
        onNavigateHome={() => navigation.navigate('Dashboard')}
        onNavigateWorkouts={() => navigation.navigate('WorkoutHistory')}
        onNavigateProgress={() => navigation.navigate('ProgressOverview')}
        onNavigateSocial={() => {}}
        onPressPlus={quickActions.open}
      />

      <QuickActionMenu
        visible={quickActions.visible}
        onClose={quickActions.close}
        onStartWorkout={quickActions.onStartWorkout}
        onLogFood={quickActions.onLogFood}
        accentColor={theme.accent}
      />
    </View>
  );
}
