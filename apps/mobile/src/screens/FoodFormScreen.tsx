import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Text } from '../design/Text';
import { useAuth } from '../auth/AuthProvider';
import { AppCard } from '../design/AppCard';
import { AppHeader } from '../design/AppHeader';
import { DestructiveButton, PrimaryButton, SecondaryButton, TextButton } from '../design/Button';
import { Screen } from '../design/Screen';
import { Section } from '../design/Section';
import { TextInput } from '../design/TextInput';
import { colors, spacing, typeScale, widgetGap } from '../design/theme';
import { uploadFoodPhoto } from '../lib/foodPhotoUpload';
import { FoodImage } from '../nutrition/FoodImage';
import { createFood, updateFood, type FoodRow } from '../nutrition/foodQueries';

type CommonProps = {
  /** Called after a save. A create passes the food it just made, so the caller can carry straight on (e.g. to logging it). */
  onDone: (saved?: FoodRow) => void;
  onCancel: () => void;
  /** The Nutrition accent for the Save button -- omit to use the brand accent. */
  accentColor?: string;
  onAccentColor?: string;
};

type Props =
  | ({ mode: 'create'; initialBarcode?: string } & CommonProps)
  | ({ mode: 'edit'; food: FoodRow } & CommonProps);

// Reachable from FoodLibraryScreen (the user's own custom foods) and, on
// create, from the Scan Barcode flow's "Product not found" fallback (see
// BarcodeScannerScreen) -- the same create/edit form either way, since a
// custom food is just a `foods` row with created_by set, same as any other
// (see foodQueries.ts). Direct Supabase writes: foods has no unique-name
// constraint to justify routing this through the backend, unlike exercises'
// ExerciseFormScreen.
//
// Layout: the shared Screen with a Cancel (X) in the header, then a stack of
// widgets -- Details (with an optional photo of the food from the user's own
// camera or library; without one it shows a category glyph), Serving and
// Nutrition per serving (size + unit and the three macros share a row each) --
// and one filled Save; when editing, Deactivate/Reactivate sits as a quiet
// outline beneath it.
export function FoodFormScreen(props: Props) {
  const { user } = useAuth();
  const userId = user?.id ?? '';

  const [name, setName] = useState(props.mode === 'edit' ? props.food.name : '');
  const [brand, setBrand] = useState(props.mode === 'edit' ? (props.food.brand ?? '') : '');
  const [barcode, setBarcode] = useState(
    props.mode === 'edit' ? (props.food.barcode ?? '') : (props.initialBarcode ?? ''),
  );
  const [servingSize, setServingSize] = useState(
    props.mode === 'edit' ? String(props.food.servingSize) : '',
  );
  const [servingUnit, setServingUnit] = useState(
    props.mode === 'edit' ? props.food.servingUnit : '',
  );
  const [calories, setCalories] = useState(
    props.mode === 'edit' ? String(props.food.calories) : '',
  );
  const [proteinG, setProteinG] = useState(
    props.mode === 'edit' ? String(props.food.proteinG) : '',
  );
  const [carbsG, setCarbsG] = useState(props.mode === 'edit' ? String(props.food.carbsG) : '');
  const [fatG, setFatG] = useState(props.mode === 'edit' ? String(props.food.fatG) : '');
  const [isActive, setIsActive] = useState(props.mode === 'edit' ? props.food.isActive : true);
  // A freshly picked photo (a local file, uploaded on Save), or the photo the
  // food already has -- which "Remove Photo" clears on Save.
  const existingImageUrl = props.mode === 'edit' ? props.food.imageUrl : null;
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoRemoved, setPhotoRemoved] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const shownPhoto = photoUri ?? (photoRemoved ? null : existingImageUrl);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const servingSizeNum = Number(servingSize);
  const caloriesNum = Number(calories);
  const proteinNum = Number(proteinG);
  const carbsNum = Number(carbsG);
  const fatNum = Number(fatG);

  const canSave =
    name.trim().length > 0 &&
    servingUnit.trim().length > 0 &&
    Number.isFinite(servingSizeNum) &&
    servingSizeNum > 0 &&
    Number.isFinite(caloriesNum) &&
    caloriesNum >= 0 &&
    Number.isFinite(proteinNum) &&
    proteinNum >= 0 &&
    Number.isFinite(carbsNum) &&
    carbsNum >= 0 &&
    Number.isFinite(fatNum) &&
    fatNum >= 0 &&
    !saving;

  function handlePickPhoto() {
    setPhotoError(null);
    Alert.alert('Food Photo', undefined, [
      { text: 'Take Photo', onPress: () => void pickPhoto('camera') },
      { text: 'Choose from Library', onPress: () => void pickPhoto('library') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  async function pickPhoto(source: 'camera' | 'library') {
    const permission =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setPhotoError(
        source === 'camera'
          ? 'Camera permission is required to take a photo.'
          : 'Photo library permission is required to choose a photo.',
      );
      return;
    }
    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    };
    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
    if (result.canceled || !result.assets[0]) return;
    setPhotoUri(result.assets[0].uri);
    setPhotoRemoved(false);
  }

  function handleRemovePhoto() {
    setPhotoUri(null);
    setPhotoRemoved(true);
  }

  async function handleSave() {
    if (!canSave) return;
    setError(null);
    setSaving(true);
    try {
      // undefined leaves the stored photo alone; null clears it.
      let imageUrl: string | null | undefined;
      if (photoUri) {
        imageUrl = await uploadFoodPhoto(userId, photoUri);
      } else if (photoRemoved) {
        imageUrl = null;
      }
      const input = {
        name: name.trim(),
        brand: brand.trim() || null,
        barcode: barcode.trim() || null,
        servingSize: servingSizeNum,
        servingUnit: servingUnit.trim(),
        calories: caloriesNum,
        proteinG: proteinNum,
        carbsG: carbsNum,
        fatG: fatNum,
        ...(imageUrl !== undefined ? { imageUrl } : {}),
      };
      if (props.mode === 'create') {
        props.onDone(await createFood(userId, input));
      } else {
        await updateFood(props.food.id, input);
        props.onDone();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save food');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive() {
    if (props.mode !== 'edit') return;
    setError(null);
    setSaving(true);
    try {
      await updateFood(props.food.id, { isActive: !isActive });
      setIsActive((prev) => !prev);
      props.onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update food');
    } finally {
      setSaving(false);
    }
  }

  const title = props.mode === 'create' ? 'New Food' : 'Edit Food';

  return (
    <Screen
      keyboardAvoiding
      scrollTestID="food-form-scroll"
      contentContainerStyle={styles.content}
      header={
        <AppHeader
          title={title}
          leftAction={{
            icon: 'x',
            onPress: props.onCancel,
            accessibilityLabel: 'Cancel',
            testID: 'food-form-cancel',
          }}
        />
      }
    >
      <AppCard>
        <Section title="Details">
          <View style={styles.group}>
            <View style={styles.photoRow}>
              <FoodImage testID="food-form-photo-preview" uri={shownPhoto} name={name} size={72} />
              <View style={styles.photoActions}>
                <SecondaryButton
                  testID="food-form-photo-add"
                  size="sm"
                  label={shownPhoto ? 'Change Photo' : 'Add Photo'}
                  accessibilityLabel={shownPhoto ? 'Change food photo' : 'Add a food photo'}
                  onPress={handlePickPhoto}
                />
                {shownPhoto ? (
                  <TextButton
                    testID="food-form-photo-remove"
                    label="Remove Photo"
                    accessibilityLabel="Remove food photo"
                    destructive
                    onPress={handleRemovePhoto}
                  />
                ) : null}
              </View>
            </View>
            {photoError ? (
              <Text testID="food-form-photo-error" style={styles.errorText}>
                {photoError}
              </Text>
            ) : null}
            <TextInput
              testID="food-form-name"
              label="Name"
              placeholder="Food name"
              value={name}
              onChangeText={setName}
            />
            <TextInput
              testID="food-form-brand"
              label="Brand (optional)"
              placeholder="e.g. Kirkland"
              value={brand}
              onChangeText={setBrand}
            />
            <TextInput
              testID="food-form-barcode"
              label="Barcode (optional)"
              placeholder="e.g. 012345678905"
              keyboardType="number-pad"
              value={barcode}
              onChangeText={setBarcode}
            />
          </View>
        </Section>
      </AppCard>

      <AppCard>
        <Section title="Serving">
          <View style={styles.row}>
            <View style={styles.cell}>
              <TextInput
                testID="food-form-serving-size"
                label="Serving size"
                placeholder="100"
                keyboardType="decimal-pad"
                value={servingSize}
                onChangeText={setServingSize}
              />
            </View>
            <View style={styles.cell}>
              <TextInput
                testID="food-form-serving-unit"
                label="Serving unit"
                placeholder="g"
                value={servingUnit}
                onChangeText={setServingUnit}
              />
            </View>
          </View>
        </Section>
      </AppCard>

      <AppCard>
        <Section title="Nutrition per serving">
          <View style={styles.group}>
            <TextInput
              testID="food-form-calories"
              label="Calories"
              placeholder="0"
              keyboardType="decimal-pad"
              value={calories}
              onChangeText={setCalories}
            />
            <View style={styles.row}>
              <View style={styles.cell}>
                <TextInput
                  testID="food-form-protein"
                  label="Protein (g)"
                  placeholder="0"
                  keyboardType="decimal-pad"
                  value={proteinG}
                  onChangeText={setProteinG}
                />
              </View>
              <View style={styles.cell}>
                <TextInput
                  testID="food-form-carbs"
                  label="Carbs (g)"
                  placeholder="0"
                  keyboardType="decimal-pad"
                  value={carbsG}
                  onChangeText={setCarbsG}
                />
              </View>
              <View style={styles.cell}>
                <TextInput
                  testID="food-form-fat"
                  label="Fat (g)"
                  placeholder="0"
                  keyboardType="decimal-pad"
                  value={fatG}
                  onChangeText={setFatG}
                />
              </View>
            </View>
          </View>
        </Section>
      </AppCard>

      <View style={styles.actions}>
        {error ? (
          <Text testID="food-form-error" style={styles.errorText}>
            {error}
          </Text>
        ) : null}

        <PrimaryButton
          testID="food-form-save"
          label="Save"
          onPress={handleSave}
          loading={saving}
          disabled={!canSave && !saving}
          accentColor={props.accentColor}
          onAccentColor={props.onAccentColor}
        />

        {props.mode === 'edit' ? (
          isActive ? (
            <DestructiveButton
              testID="food-form-toggle-active"
              label="Deactivate"
              onPress={handleToggleActive}
              disabled={saving}
            />
          ) : (
            <SecondaryButton
              testID="food-form-toggle-active"
              label="Reactivate"
              onPress={handleToggleActive}
              disabled={saving}
            />
          )
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: widgetGap,
  },
  group: {
    gap: spacing.lg,
  },
  photoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  photoActions: {
    flex: 1,
    alignItems: 'flex-start',
    gap: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  cell: {
    flex: 1,
  },
  actions: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  errorText: {
    ...typeScale.callout,
    color: colors.destructive,
  },
});
