import type { Feather } from '@expo/vector-icons';

// Shared presentational metadata for the 5 workout-split presets -- used by
// both ChooseWorkoutSplitScreen (Settings/the tracking gate) and
// WorkoutSplitPresetPicker (onboarding's split step), so the two places a
// user can pick a preset show the exact same icon/description copy rather
// than two copies that could drift apart. Purely presentational: no part
// of workoutSplitPresets.ts's actual split/day/muscle-group data.

export const PRESET_ICONS: Record<string, keyof typeof Feather.glyphMap> = {
  ppl: 'bar-chart-2',
  'upper-lower': 'repeat',
  'full-body': 'target',
  'bro-split': 'grid',
  'ppl-upper-lower': 'layers',
};

export const PRESET_DESCRIPTIONS: Record<string, string> = {
  ppl: 'A balanced and popular split for strength and muscle growth.',
  'upper-lower': 'A simple, effective split great for strength and flexibility.',
  'full-body': 'Train everything in each session. Great for beginners or busy schedules.',
  'bro-split': 'Focus on one muscle group per day. Classic and straightforward.',
  'ppl-upper-lower': 'The most complete split for maximum variety and progression.',
};
