import { useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { AppHeader } from '../design/AppHeader';
import { PrimaryButton } from '../design/Button';
import { ErrorState } from '../design/ErrorState';
import { LoadingState } from '../design/LoadingState';
import { Screen } from '../design/Screen';
import { SegmentedControl } from '../design/SegmentedControl';
import { TextInput } from '../design/TextInput';
import { spacing } from '../design/theme';
import {
  addTrainerClient,
  listTrainerClients,
  trackTrainerClient,
  updateTrainerClientProfile,
} from '../lib/api';
import type { RootStackScreenProps } from '../navigation/types';
import { cmFromFeetAndInches, feetAndInchesFromCm } from '../onboarding/weightHeightConversion';

type Props = RootStackScreenProps<'TrainerClientForm' | 'TrainerEditClient'>;

/** Username finds an existing account (a request); email invites someone (an invite). */
export type AddMode = 'username' | 'email' | 'untracked';

export interface ClientFormValues {
  mode: AddMode;
  username: string;
  email: string;
  name: string;
  heightUnit: 'cm' | 'ft_in';
  heightText: string;
  feetText: string;
  inchesText: string;
  weightText: string;
  weightUnit: 'kg' | 'lb';
}

/** Height in cm, or in whole feet and inches. A blank height is not sent. */
export function validateHeight(
  values: Pick<ClientFormValues, 'heightUnit' | 'heightText' | 'feetText' | 'inchesText'>,
): string | undefined {
  if (values.heightUnit === 'cm') {
    if (values.heightText.trim() === '') return undefined;
    const height = Number(values.heightText);
    if (!Number.isFinite(height) || height <= 0 || height > MAX_HEIGHT_CM) {
      return `Enter a height between 1 and ${MAX_HEIGHT_CM} cm`;
    }
    return undefined;
  }
  if (values.feetText.trim() === '' && values.inchesText.trim() === '') return undefined;
  const feet = Number(values.feetText);
  const inches = values.inchesText.trim() === '' ? 0 : Number(values.inchesText);
  const feetOk = Number.isInteger(feet) && feet >= 3 && feet <= 8;
  const inchesOk = Number.isInteger(inches) && inches >= 0 && inches <= 11;
  if (!feetOk || !inchesOk) return 'Enter feet from 3 to 8, and inches from 0 to 11';
  return undefined;
}

/** The height in cm that the form's values describe, or undefined when none was entered. */
export function heightCmFromValues(values: ClientFormValues): number | undefined {
  if (values.heightUnit === 'cm') {
    return values.heightText.trim() === '' ? undefined : Number(values.heightText);
  }
  if (values.feetText.trim() === '' && values.inchesText.trim() === '') return undefined;
  const inches = values.inchesText.trim() === '' ? 0 : Number(values.inchesText);
  return Math.round(cmFromFeetAndInches(Number(values.feetText), inches));
}

export type ClientFormErrors = Partial<
  Record<'username' | 'email' | 'name' | 'height' | 'weight', string>
>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,20}$/;
const MAX_HEIGHT_CM = 300;
const MAX_WEIGHT = 1000;

/**
 * Checks the form before anything is sent. Height and weight are optional, and
 * only an email invite takes them: an existing account's profile belongs to its
 * owner. The name is optional, since it is only a convenience for the invite.
 */
export function validateClientForm(values: ClientFormValues, isNew: boolean): ClientFormErrors {
  const errors: ClientFormErrors = {};
  const takesDetails = !isNew || values.mode !== 'username';

  if (isNew && values.mode === 'username' && !USERNAME_PATTERN.test(values.username.trim())) {
    errors.username = 'Usernames are 3–20 letters, numbers or underscores';
  }
  if (isNew && values.mode === 'email' && !EMAIL_PATTERN.test(values.email.trim())) {
    errors.email = 'Enter a valid email address';
  }
  if (isNew && values.mode === 'untracked' && values.name.trim() === '') {
    errors.name = 'Enter their name';
  }
  if (takesDetails) {
    const heightError = validateHeight(values);
    if (heightError) errors.height = heightError;
  }
  if (takesDetails && values.weightText.trim() !== '') {
    const weight = Number(values.weightText);
    if (!Number.isFinite(weight) || weight <= 0 || weight > MAX_WEIGHT) {
      errors.weight = `Enter a weight between 1 and ${MAX_WEIGHT}`;
    }
  }
  return errors;
}

/**
 * Adds a client by username (a request to an existing account) or by email (an
 * invite), or edits the details of a managed client. A linked client's details
 * belong to them, so this screen is never offered for one.
 */
export function TrainerClientFormScreen({ navigation, route }: Props) {
  // Only TrainerEditClient carries a client; TrainerClientForm (add) has no params.
  const clientId = (route?.params as { clientId: string } | undefined)?.clientId;
  const isNew = !clientId;
  const { session } = useAuth();
  const accessToken = session?.access_token;

  const [loading, setLoading] = useState(!isNew);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [values, setValues] = useState<ClientFormValues>({
    mode: 'untracked',
    username: '',
    email: '',
    name: '',
    heightUnit: 'cm',
    heightText: '',
    feetText: '',
    inchesText: '',
    weightText: '',
    weightUnit: 'kg',
  });
  const [errors, setErrors] = useState<ClientFormErrors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (isNew || !accessToken) return;
    let cancelled = false;
    async function loadExisting() {
      setLoading(true);
      setLoadError(null);
      try {
        const clients = await listTrainerClients(accessToken!);
        const existing = clients.find((client) => client.clientId === clientId);
        if (cancelled) return;
        if (!existing) {
          setLoadError('This client is no longer linked to your account');
          return;
        }
        setValues((prev) => ({
          ...prev,
          name: existing.displayName ?? '',
          heightUnit: existing.heightUnit,
          heightText: existing.heightValue === null ? '' : String(Math.round(existing.heightValue)),
          ...(existing.heightValue === null
            ? { feetText: '', inchesText: '' }
            : (() => {
                const { feet, inches } = feetAndInchesFromCm(existing.heightValue);
                return { feetText: String(feet), inchesText: String(inches) };
              })()),
          weightText: existing.weightValue === null ? '' : String(existing.weightValue),
          weightUnit: existing.weightUnit,
        }));
      } catch (err) {
        if (!cancelled)
          setLoadError(err instanceof Error ? err.message : 'Could not load this client');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadExisting();
    return () => {
      cancelled = true;
    };
  }, [isNew, accessToken, clientId]);

  function update<K extends keyof ClientFormValues>(key: K, value: ClientFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    if (!accessToken || saving) return;
    const found = validateClientForm(values, isNew);
    setErrors(found);
    setSaveError(null);
    if (Object.keys(found).length > 0) return;

    const details = {
      displayName: values.name.trim() || undefined,
      heightValue: heightCmFromValues(values),
      heightUnit: heightCmFromValues(values) === undefined ? undefined : values.heightUnit,
      weightValue: values.weightText.trim() === '' ? undefined : Number(values.weightText),
      weightUnit: values.weightText.trim() === '' ? undefined : values.weightUnit,
    };

    setSaving(true);
    try {
      if (isNew && values.mode === 'untracked') {
        // No account yet: track the client and show the code to give them.
        const tracked = await trackTrainerClient(accessToken, {
          displayName: values.name.trim(),
          heightValue: details.heightValue,
          heightUnit: details.heightUnit,
          weightValue: details.weightValue,
          weightUnit: details.weightUnit,
        });
        navigation.replace('TrainerClaimCode', {
          code: tracked.claimCode,
          clientId: tracked.clientId,
          clientName: values.name.trim(),
        });
        return;
      }

      if (isNew && values.mode === 'username') {
        const result = await addTrainerClient(accessToken, {
          username: values.username.trim().toLowerCase(),
        });
        if (result.kind === 'request' && result.status === 'active') {
          navigation.replace('TrainerClientDetail', { clientId: result.clientId });
          return;
        }
        Alert.alert('Request sent', 'They need to accept it before you can log workouts for them.');
        navigation.goBack();
        return;
      }

      if (isNew) {
        // The same answer for every address, so a trainer cannot learn who has an account.
        await addTrainerClient(accessToken, {
          email: values.email.trim().toLowerCase(),
          ...details,
        });
        Alert.alert(
          'Invite sent',
          'They’ll see it when they open Progresso. If they already use Progresso, ask for their username and add them that way.',
        );
        navigation.goBack();
        return;
      }

      await updateTrainerClientProfile(accessToken, clientId!, details);
      navigation.goBack();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not save this client');
      setSaving(false);
    }
  }

  const addingByEmail = isNew && values.mode === 'email';
  const addingNew = isNew && values.mode !== 'username';

  return (
    <Screen
      scrollTestID="trainer-client-form-scroll"
      keyboardAvoiding
      header={
        <AppHeader
          title={isNew ? 'Add Client' : 'Edit Details'}
          onBack={() => navigation.goBack()}
          testID="trainer-client-form-header"
        />
      }
    >
      {loading ? <LoadingState testID="trainer-client-form-loading" /> : null}

      {loadError ? (
        <ErrorState testID="trainer-client-form-load-error" message={loadError} />
      ) : null}

      {!loading && !loadError ? (
        <View style={{ gap: spacing.md }}>
          {isNew ? (
            <SegmentedControl
              testID="trainer-client-mode"
              value={values.mode}
              onChange={(mode) => {
                update('mode', mode);
                setErrors({});
              }}
              options={[
                { value: 'untracked', label: 'No account' },
                { value: 'username', label: 'Username' },
                { value: 'email', label: 'Email invite' },
              ]}
            />
          ) : null}

          {isNew && values.mode === 'username' ? (
            <TextInput
              testID="trainer-client-username"
              label="Their Progresso username"
              value={values.username}
              onChangeText={(text) => update('username', text)}
              autoCapitalize="none"
              error={errors.username}
              helperText="They'll get a request to accept. Nothing about their account is shown to you."
            />
          ) : null}

          {addingByEmail ? (
            <TextInput
              testID="trainer-client-email"
              label="Email"
              value={values.email}
              onChangeText={(text) => update('email', text)}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              error={errors.email}
              helperText="They'll see the invite when they open Progresso."
            />
          ) : null}

          {!isNew || addingNew ? (
            <TextInput
              testID="trainer-client-name"
              label="Name"
              value={values.name}
              onChangeText={(text) => update('name', text)}
              error={errors.name}
            />
          ) : null}

          {!isNew || addingNew ? (
            <SegmentedControl
              testID="trainer-client-height-unit"
              value={values.heightUnit}
              onChange={(unit) => update('heightUnit', unit)}
              options={[
                { value: 'cm', label: 'cm' },
                { value: 'ft_in', label: 'ft / in' },
              ]}
            />
          ) : null}

          {!isNew || addingNew ? (
            values.heightUnit === 'cm' ? (
              <TextInput
                testID="trainer-client-height"
                label="Height (cm)"
                value={values.heightText}
                onChangeText={(text) => update('heightText', text)}
                keyboardType="decimal-pad"
                error={errors.height}
              />
            ) : (
              <View style={{ flexDirection: 'row', gap: spacing.md }}>
                <View style={{ flex: 1 }}>
                  <TextInput
                    testID="trainer-client-height-feet"
                    label="Feet"
                    value={values.feetText}
                    onChangeText={(text) => update('feetText', text)}
                    keyboardType="number-pad"
                    error={errors.height}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <TextInput
                    testID="trainer-client-height-inches"
                    label="Inches"
                    value={values.inchesText}
                    onChangeText={(text) => update('inchesText', text)}
                    keyboardType="number-pad"
                  />
                </View>
              </View>
            )
          ) : null}

          {!isNew || addingNew ? (
            <TextInput
              testID="trainer-client-weight"
              label="Weight"
              value={values.weightText}
              onChangeText={(text) => update('weightText', text)}
              keyboardType="decimal-pad"
              error={errors.weight}
            />
          ) : null}

          {!isNew || addingNew ? (
            <SegmentedControl
              testID="trainer-client-weight-unit"
              value={values.weightUnit}
              onChange={(unit) => update('weightUnit', unit)}
              options={[
                { value: 'kg', label: 'kg' },
                { value: 'lb', label: 'lb' },
              ]}
            />
          ) : null}

          {saveError ? <ErrorState testID="trainer-client-form-error" message={saveError} /> : null}

          <PrimaryButton
            testID="trainer-client-save"
            label={
              !isNew
                ? 'Save Details'
                : values.mode === 'untracked'
                  ? 'Create Client'
                  : addingByEmail
                    ? 'Send Invite'
                    : 'Send Request'
            }
            onPress={() => void handleSave()}
            loading={saving}
            disabled={saving}
          />
        </View>
      ) : null}
    </Screen>
  );
}
