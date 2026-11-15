import { useState } from 'react';
import { Text } from '../design/Text';
import { useAuth } from '../auth/AuthProvider';
import { PrimaryButton, TextButton } from '../design/Button';
import { TextInput } from '../design/TextInput';
import { phoneCountry, toE164 } from '../lib/phoneNumbers';
import { useProfile } from '../profile/ProfileProvider';
import { AuthFrame } from './AuthFrame';
import { authStyles as styles } from './authStyles';

/**
 * Asked once of everyone who signed up before a phone number was (App.tsx shows it in place of
 * the app while their profile has none): their number, so friends with it in their contacts can
 * find them. It can't be skipped -- only saved, or signed out of. Saved to the shared profile,
 * which lets the app through at once.
 */
export function AddPhoneNumberScreen() {
  const { signOut } = useAuth();
  const { profile, updateProfile } = useProfile();
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const phoneNumber = toE164(phone, phoneCountry(profile?.country));

  async function handleSave() {
    if (!phoneNumber) {
      setError('Enter a valid phone number.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await updateProfile({ phoneNumber });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your number');
      setSaving(false);
    }
  }

  return (
    <AuthFrame
      title="Add Your Phone Number"
      subtitle="So friends with your number in their contacts can find you on Progresso. It's never shown to anyone."
    >
      <TextInput
        testID="add-phone-number-input"
        label="Phone Number"
        placeholder="Your mobile number"
        keyboardType="phone-pad"
        autoComplete="tel"
        returnKeyType="done"
        value={phone}
        onChangeText={setPhone}
        onSubmitEditing={() => void handleSave()}
      />

      {error ? (
        <Text testID="add-phone-number-error" style={styles.errorText}>
          {error}
        </Text>
      ) : null}

      <PrimaryButton
        testID="add-phone-number-save"
        label="Continue"
        onPress={() => void handleSave()}
        loading={saving}
        disabled={phoneNumber === null && !saving}
      />
      <TextButton
        testID="add-phone-number-sign-out"
        label="Sign Out"
        onPress={() => void signOut()}
      />
    </AuthFrame>
  );
}
