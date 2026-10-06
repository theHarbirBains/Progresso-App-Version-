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
import { addTrainerClient, listTrainerClients, updateTrainerClientProfile } from '../lib/api';
import type { RootStackScreenProps } from '../navigation/types';

type Props = RootStackScreenProps<'TrainerClientForm' | 'TrainerEditClient'>;

export interface ClientFormValues {
  email: string;
  name: string;
  heightText: string;
  weightText: string;
  weightUnit: 'kg' | 'lb';
}

export type ClientFormErrors = Partial<Record<'email' | 'name' | 'height' | 'weight', string>>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_HEIGHT_CM = 300;
const MAX_WEIGHT = 1000;

/**
 * Checks the form before anything is sent. Height and weight are optional; a
 * blank field is simply not sent. The email is only checked when adding, since
 * an existing client's email cannot be changed here.
 */
export function validateClientForm(values: ClientFormValues, isNew: boolean): ClientFormErrors {
  const errors: ClientFormErrors = {};
  if (isNew && !EMAIL_PATTERN.test(values.email.trim())) {
    errors.email = 'Enter a valid email address';
  }
  if (isNew && values.name.trim() === '') {
    errors.name = 'Enter their name';
  }
  if (values.heightText.trim() !== '') {
    const height = Number(values.heightText);
    if (!Number.isFinite(height) || height <= 0 || height > MAX_HEIGHT_CM) {
      errors.height = `Enter a height between 1 and ${MAX_HEIGHT_CM} cm`;
    }
  }
  if (values.weightText.trim() !== '') {
    const weight = Number(values.weightText);
    if (!Number.isFinite(weight) || weight <= 0 || weight > MAX_WEIGHT) {
      errors.weight = `Enter a weight between 1 and ${MAX_WEIGHT}`;
    }
  }
  return errors;
}

/**
 * Adds a client by email, or edits the details of a managed client. A linked
 * client's details belong to them, so this screen is never offered for one.
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
    email: '',
    name: '',
    heightText: '',
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
        setValues({
          email: '',
          name: existing.displayName ?? '',
          heightText: existing.heightValue === null ? '' : String(existing.heightValue),
          weightText: existing.weightValue === null ? '' : String(existing.weightValue),
          weightUnit: existing.weightUnit,
        });
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
      heightValue: values.heightText.trim() === '' ? undefined : Number(values.heightText),
      // The form always takes height in cm. Managed clients are created here, so their
      // stored unit is cm as well.
      heightUnit: values.heightText.trim() === '' ? undefined : ('cm' as const),
      weightValue: values.weightText.trim() === '' ? undefined : Number(values.weightText),
      weightUnit: values.weightText.trim() === '' ? undefined : values.weightUnit,
    };

    setSaving(true);
    try {
      if (isNew) {
        const result = await addTrainerClient(accessToken, {
          email: values.email.trim().toLowerCase(),
          ...details,
        });
        if (result.status === 'pending') {
          Alert.alert(
            'Request sent',
            'They need to accept it before you can log workouts for them.',
          );
          navigation.goBack();
          return;
        }
        navigation.replace('TrainerClientDetail', {
          clientId: result.clientId,
          clientName: values.name.trim(),
        });
        return;
      }
      await updateTrainerClientProfile(accessToken, clientId!, details);
      navigation.goBack();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not save this client');
      setSaving(false);
    }
  }

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
            <TextInput
              testID="trainer-client-email"
              label="Email"
              value={values.email}
              onChangeText={(text) => update('email', text)}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              error={errors.email}
              helperText="If they already have an account, they'll get a request to accept."
            />
          ) : null}

          <TextInput
            testID="trainer-client-name"
            label="Name"
            value={values.name}
            onChangeText={(text) => update('name', text)}
            error={errors.name}
          />

          <TextInput
            testID="trainer-client-height"
            label="Height (cm)"
            value={values.heightText}
            onChangeText={(text) => update('heightText', text)}
            keyboardType="decimal-pad"
            error={errors.height}
          />

          <TextInput
            testID="trainer-client-weight"
            label="Weight"
            value={values.weightText}
            onChangeText={(text) => update('weightText', text)}
            keyboardType="decimal-pad"
            error={errors.weight}
          />

          <SegmentedControl
            testID="trainer-client-weight-unit"
            value={values.weightUnit}
            onChange={(unit) => update('weightUnit', unit)}
            options={[
              { value: 'kg', label: 'kg' },
              { value: 'lb', label: 'lb' },
            ]}
          />

          {saveError ? <ErrorState testID="trainer-client-form-error" message={saveError} /> : null}

          <PrimaryButton
            testID="trainer-client-save"
            label={isNew ? 'Add Client' : 'Save Details'}
            onPress={() => void handleSave()}
            loading={saving}
            disabled={saving}
          />
        </View>
      ) : null}
    </Screen>
  );
}
