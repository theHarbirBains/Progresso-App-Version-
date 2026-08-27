import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { getMyProfile, updateMyProfile } from '../lib/api';
import type { RootStackScreenProps } from '../navigation/types';
import { authStyles as styles } from './authStyles';

type Props = RootStackScreenProps<'AccountSettings'>;

// The authenticated home for Phase 0/1/2/3 — there's no dashboard yet, so
// this screen doubles as both "you're signed in" proof and real account
// management. Not the final Progresso visual design.
export function AccountSettingsScreen({ navigation }: Props) {
  const { user, session, signOut } = useAuth();
  const accessToken = session?.access_token;

  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [weightUnit, setWeightUnit] = useState<'kg' | 'lb'>('kg');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      if (!accessToken) return;
      try {
        const profile = await getMyProfile(accessToken);
        if (!mounted) return;
        setDisplayName(profile.displayName ?? '');
        setUsername(profile.username ?? '');
        setWeightUnit(profile.weightUnit);
      } catch (err) {
        if (mounted) {
          setLoadError(err instanceof Error ? err.message : 'Failed to load profile');
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [accessToken]);

  async function handleSave() {
    if (!accessToken) return;
    setSaveError(null);
    setSavedMessage(null);
    setSaving(true);
    try {
      const profile = await updateMyProfile(accessToken, {
        displayName: displayName.trim(),
        username: username.trim() || undefined,
        weightUnit,
      });
      setDisplayName(profile.displayName ?? '');
      setUsername(profile.username ?? '');
      setSavedMessage('Saved');
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator testID="account-loading" size="large" color="#FFFFFF" />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Account Settings</Text>
      <Text testID="account-email" style={styles.info}>
        {user?.email}
      </Text>

      {loadError ? (
        <Text testID="account-load-error" style={styles.error}>
          {loadError}
        </Text>
      ) : null}

      <Text style={styles.label}>Display name</Text>
      <TextInput
        testID="account-display-name"
        style={styles.input}
        placeholder="Display name"
        placeholderTextColor="#6B6B75"
        value={displayName}
        onChangeText={setDisplayName}
      />

      <Text style={styles.label}>Username</Text>
      <TextInput
        testID="account-username"
        style={styles.input}
        placeholder="username"
        placeholderTextColor="#6B6B75"
        autoCapitalize="none"
        value={username}
        onChangeText={(text) => setUsername(text.toLowerCase())}
      />

      <Text style={styles.label}>Weight unit</Text>
      <View style={styles.unitToggleRow}>
        <TouchableOpacity
          testID="account-unit-kg"
          style={[styles.unitOption, weightUnit === 'kg' && styles.unitOptionSelected]}
          onPress={() => setWeightUnit('kg')}
        >
          <Text
            style={[styles.unitOptionText, weightUnit === 'kg' && styles.unitOptionTextSelected]}
          >
            kg
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID="account-unit-lb"
          style={[styles.unitOption, weightUnit === 'lb' && styles.unitOptionSelected]}
          onPress={() => setWeightUnit('lb')}
        >
          <Text
            style={[styles.unitOptionText, weightUnit === 'lb' && styles.unitOptionTextSelected]}
          >
            lb
          </Text>
        </TouchableOpacity>
      </View>

      {saveError ? (
        <Text testID="account-save-error" style={styles.error}>
          {saveError}
        </Text>
      ) : null}
      {savedMessage ? (
        <Text testID="account-saved" style={styles.info}>
          {savedMessage}
        </Text>
      ) : null}

      <TouchableOpacity
        testID="account-save"
        style={styles.button}
        onPress={handleSave}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator color="#0B0B0F" />
        ) : (
          <Text style={styles.buttonText}>Save</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        testID="open-workouts"
        style={styles.oauthButton}
        onPress={() => navigation.navigate('WorkoutHistory')}
      >
        <Text style={styles.oauthButtonText}>Workouts</Text>
      </TouchableOpacity>

      <TouchableOpacity
        testID="open-exercise-library"
        style={styles.oauthButton}
        onPress={() => navigation.navigate('ExerciseLibrary')}
      >
        <Text style={styles.oauthButtonText}>Exercise Library</Text>
      </TouchableOpacity>

      <TouchableOpacity
        testID="open-nutrition"
        style={styles.oauthButton}
        onPress={() => navigation.navigate('Nutrition')}
      >
        <Text style={styles.oauthButtonText}>Nutrition</Text>
      </TouchableOpacity>

      <TouchableOpacity
        testID="sign-out-button"
        style={styles.signOutButton}
        onPress={() => signOut()}
      >
        <Text style={styles.signOutButtonText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
