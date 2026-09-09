import { ConflictException, NotFoundException } from '@nestjs/common';
import type { SupabaseService } from '../supabase/supabase.service';
import { UsersService } from './users.service';

function createMockClient(options: {
  selectData?: Record<string, unknown> | null;
  selectError?: { message: string } | null;
  updateData?: Record<string, unknown> | null;
  updateError?: { code?: string; message: string } | null;
}) {
  const selectMaybeSingle = jest
    .fn()
    .mockResolvedValue({ data: options.selectData ?? null, error: options.selectError ?? null });
  const selectEq = jest.fn().mockReturnValue({ maybeSingle: selectMaybeSingle });
  const select = jest.fn().mockReturnValue({ eq: selectEq });

  const updateMaybeSingle = jest
    .fn()
    .mockResolvedValue({ data: options.updateData ?? null, error: options.updateError ?? null });
  const updateSelect = jest.fn().mockReturnValue({ maybeSingle: updateMaybeSingle });
  const updateEq = jest.fn().mockReturnValue({ select: updateSelect });
  const update = jest.fn().mockReturnValue({ eq: updateEq });

  const from = jest.fn().mockReturnValue({ select, update });
  return { from, select, selectEq, update, updateEq, updateSelect };
}

function serviceWith(client: ReturnType<typeof createMockClient>): UsersService {
  const supabaseService = { getClient: () => client } as unknown as SupabaseService;
  return new UsersService(supabaseService);
}

describe('UsersService', () => {
  describe('getProfile', () => {
    it('returns the profile when found', async () => {
      const client = createMockClient({
        selectData: {
          weight_unit: 'kg',
          display_name: 'Harbir',
          username: 'harbir',
          workout_accent_color: '#2F80FF',
          nutrition_accent_color: '#10B981',
          active_workout_split_id: 'split-1',
        },
      });
      const service = serviceWith(client);

      await expect(service.getProfile('user-1')).resolves.toEqual({
        weightUnit: 'kg',
        displayName: 'Harbir',
        username: 'harbir',
        workoutAccentColor: '#2F80FF',
        nutritionAccentColor: '#10B981',
        activeWorkoutSplitId: 'split-1',
      });
    });

    it('throws NotFoundException when no row exists', async () => {
      const client = createMockClient({ selectData: null });
      const service = serviceWith(client);

      await expect(service.getProfile('user-1')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('updateProfile', () => {
    it('updates only the provided fields', async () => {
      const client = createMockClient({
        updateData: {
          weight_unit: 'lb',
          display_name: 'Harbir',
          username: null,
          workout_accent_color: null,
          nutrition_accent_color: null,
          active_workout_split_id: null,
        },
      });
      const service = serviceWith(client);

      await service.updateProfile('user-1', { weightUnit: 'lb' });

      expect(client.update).toHaveBeenCalledWith({ weight_unit: 'lb' });
      expect(client.updateEq).toHaveBeenCalledWith('id', 'user-1');
    });

    it('updates the workout and nutrition accent colors independently', async () => {
      const client = createMockClient({
        updateData: {
          weight_unit: 'kg',
          display_name: null,
          username: null,
          workout_accent_color: '#EF4444',
          nutrition_accent_color: null,
          active_workout_split_id: null,
        },
      });
      const service = serviceWith(client);

      const result = await service.updateProfile('user-1', { workoutAccentColor: '#EF4444' });

      expect(client.update).toHaveBeenCalledWith({ workout_accent_color: '#EF4444' });
      expect(result.workoutAccentColor).toBe('#EF4444');
      expect(result.nutritionAccentColor).toBeNull();
    });

    it('updates the active workout split', async () => {
      const client = createMockClient({
        updateData: {
          weight_unit: 'kg',
          display_name: null,
          username: null,
          workout_accent_color: null,
          nutrition_accent_color: null,
          active_workout_split_id: 'split-1',
        },
      });
      const service = serviceWith(client);

      const result = await service.updateProfile('user-1', { activeWorkoutSplitId: 'split-1' });

      expect(client.update).toHaveBeenCalledWith({ active_workout_split_id: 'split-1' });
      expect(result.activeWorkoutSplitId).toBe('split-1');
    });

    it('updates onboarding profile fields', async () => {
      const client = createMockClient({
        updateData: {
          weight_unit: 'kg',
          display_name: null,
          username: null,
          workout_accent_color: null,
          nutrition_accent_color: null,
          active_workout_split_id: null,
          gender: 'other',
          birthday: '2001-09-14',
          weight_value: 79.2,
          height_value: 174,
          height_unit: 'cm',
          fitness_goal: 'build_muscle',
          training_experience: 'intermediate',
          workout_frequency_days: 4,
          training_style_preference: 'build_your_own',
          email_opt_in: true,
          push_notifications_opt_in: false,
          apple_health_preference: 'not_now',
          onboarding_completed_at: null,
        },
      });
      const service = serviceWith(client);

      const result = await service.updateProfile('user-1', {
        gender: 'other',
        birthday: '2001-09-14',
        weightValue: 79.2,
        heightValue: 174,
        heightUnit: 'cm',
        fitnessGoal: 'build_muscle',
        trainingExperience: 'intermediate',
        workoutFrequencyDays: 4,
        trainingStylePreference: 'build_your_own',
        emailOptIn: true,
        pushNotificationsOptIn: false,
        appleHealthPreference: 'not_now',
      });

      expect(client.update).toHaveBeenCalledWith({
        gender: 'other',
        birthday: '2001-09-14',
        weight_value: 79.2,
        height_value: 174,
        height_unit: 'cm',
        fitness_goal: 'build_muscle',
        training_experience: 'intermediate',
        workout_frequency_days: 4,
        training_style_preference: 'build_your_own',
        email_opt_in: true,
        push_notifications_opt_in: false,
        apple_health_preference: 'not_now',
      });
      expect(result.fitnessGoal).toBe('build_muscle');
      expect(result.pushNotificationsOptIn).toBe(false);
    });

    it('marks onboarding complete as a server-set timestamp, not a client-supplied value', async () => {
      const client = createMockClient({
        updateData: {
          weight_unit: 'kg',
          display_name: null,
          username: null,
          workout_accent_color: null,
          nutrition_accent_color: null,
          active_workout_split_id: null,
          onboarding_completed_at: '2026-09-08T00:00:00.000Z',
        },
      });
      const service = serviceWith(client);

      const result = await service.updateProfile('user-1', { onboardingCompleted: true });

      const updateArg = client.update.mock.calls[0][0] as { onboarding_completed_at: string };
      expect(typeof updateArg.onboarding_completed_at).toBe('string');
      expect(result.onboardingCompletedAt).toBe('2026-09-08T00:00:00.000Z');
    });

    it('is a no-op read when the dto is empty (no fields to update)', async () => {
      const client = createMockClient({
        selectData: {
          weight_unit: 'kg',
          display_name: null,
          username: null,
          workout_accent_color: null,
          nutrition_accent_color: null,
          active_workout_split_id: null,
        },
      });
      const service = serviceWith(client);

      const result = await service.updateProfile('user-1', {});

      expect(client.update).not.toHaveBeenCalled();
      expect(result).toEqual({
        weightUnit: 'kg',
        displayName: null,
        username: null,
        workoutAccentColor: null,
        nutritionAccentColor: null,
        activeWorkoutSplitId: null,
      });
    });

    it('translates a unique-violation into ConflictException', async () => {
      const client = createMockClient({ updateError: { code: '23505', message: 'duplicate key' } });
      const service = serviceWith(client);

      await expect(service.updateProfile('user-1', { username: 'taken' })).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('throws NotFoundException when the target row does not exist', async () => {
      const client = createMockClient({ updateData: null });
      const service = serviceWith(client);

      await expect(service.updateProfile('user-1', { displayName: 'X' })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('isUsernameAvailable', () => {
    it('is available when no row has that username', async () => {
      const client = createMockClient({ selectData: null });
      const service = serviceWith(client);

      await expect(service.isUsernameAvailable('newname', 'user-1')).resolves.toBe(true);
    });

    it('is available when the only match is the same user (keeping their own username)', async () => {
      const client = createMockClient({ selectData: { id: 'user-1' } });
      const service = serviceWith(client);

      await expect(service.isUsernameAvailable('myname', 'user-1')).resolves.toBe(true);
    });

    it('is unavailable when a different user already has it', async () => {
      const client = createMockClient({ selectData: { id: 'user-2' } });
      const service = serviceWith(client);

      await expect(service.isUsernameAvailable('taken', 'user-1')).resolves.toBe(false);
    });

    it('normalizes case before checking', async () => {
      const client = createMockClient({ selectData: null });
      const service = serviceWith(client);

      await service.isUsernameAvailable('Harbir', 'user-1');

      expect(client.selectEq).toHaveBeenCalledWith('username', 'harbir');
    });
  });
});
