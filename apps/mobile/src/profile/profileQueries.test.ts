import { supabase } from '../lib/supabase';
import { fetchMyProfile } from './profileQueries';

jest.mock('../lib/supabase', () => ({
  supabase: { from: jest.fn() },
}));

const mockFrom = supabase.from as jest.Mock;

function mockQuery(result: { data: unknown; error: { message: string } | null }) {
  const maybeSingle = jest.fn().mockResolvedValue(result);
  const eq = jest.fn().mockReturnValue({ maybeSingle });
  const select = jest.fn().mockReturnValue({ eq });
  mockFrom.mockReturnValue({ select });
  return { select, eq, maybeSingle };
}

const row = {
  weight_unit: 'lb',
  display_name: 'Harbir',
  username: 'harbir',
  workout_accent_color: '#EF4444',
  nutrition_accent_color: null,
  background_theme: 'obsidian',
  avatar_url: null,
  active_workout_split_id: 'split-1',
  gender: 'male',
  birthday: '1999-04-02',
  weight_value: 80,
  height_value: 180,
  height_unit: 'cm',
  fitness_goal: 'build_muscle',
  training_experience: 'intermediate',
  workout_frequency_days: 4,
  training_style_preference: 'guided',
  email_opt_in: false,
  push_notifications_opt_in: true,
  apple_health_preference: null,
  onboarding_completed_at: '2026-09-01T00:00:00Z',
  activity_level: 'moderately_active',
  referral_source: 'friend',
  country: 'CA',
  average_workout_length: '45_60',
};

beforeEach(() => {
  mockFrom.mockReset();
});

describe('fetchMyProfile', () => {
  it("reads the signed-in user's own row and maps it to the profile shape", async () => {
    const { eq } = mockQuery({ data: row, error: null });

    const profile = await fetchMyProfile('user-1');

    expect(mockFrom).toHaveBeenCalledWith('users');
    // Filtered by id: a trainer can also read their clients' rows, so RLS alone isn't enough.
    expect(eq).toHaveBeenCalledWith('id', 'user-1');
    expect(profile).toEqual({
      id: 'user-1',
      weightUnit: 'lb',
      displayName: 'Harbir',
      username: 'harbir',
      workoutAccentColor: '#EF4444',
      nutritionAccentColor: null,
      backgroundTheme: 'obsidian',
      avatarUrl: null,
      activeWorkoutSplitId: 'split-1',
      gender: 'male',
      birthday: '1999-04-02',
      weightValue: 80,
      heightValue: 180,
      heightUnit: 'cm',
      fitnessGoal: 'build_muscle',
      trainingExperience: 'intermediate',
      workoutFrequencyDays: 4,
      trainingStylePreference: 'guided',
      emailOptIn: false,
      pushNotificationsOptIn: true,
      appleHealthPreference: null,
      onboardingCompletedAt: '2026-09-01T00:00:00Z',
      activityLevel: 'moderately_active',
      referralSource: 'friend',
      country: 'CA',
      averageWorkoutLength: '45_60',
    });
  });

  it('selects exactly the columns the API returns', async () => {
    const { select } = mockQuery({ data: row, error: null });

    await fetchMyProfile('user-1');

    const columns = (select.mock.calls[0][0] as string).split(',').map((c) => c.trim());
    expect(columns.sort()).toEqual(Object.keys(row).sort());
  });

  it('throws the database error message when the query fails', async () => {
    mockQuery({ data: null, error: { message: 'permission denied for table users' } });

    await expect(fetchMyProfile('user-1')).rejects.toThrow('permission denied for table users');
  });

  it('throws when there is no profile row for the user', async () => {
    mockQuery({ data: null, error: null });

    await expect(fetchMyProfile('user-1')).rejects.toThrow('User profile not found');
  });
});
