import type { Feather } from '@expo/vector-icons';
import type { MembershipTier } from '../lib/api';

// The memberships a person chooses between (users.membership_tier) -- which parts of the app
// they use. All free for now, picked in onboarding and changeable any time in Settings >
// Membership. A part a membership leaves out shows as locked, with a way to change membership,
// never as broken or missing.

export interface MembershipOption {
  tier: MembershipTier;
  name: string;
  /** One plain line on what it is. */
  summary: string;
  /** What it includes, a few words each. */
  includes: string[];
  icon: keyof typeof Feather.glyphMap;
}

export const MEMBERSHIP_OPTIONS: MembershipOption[] = [
  {
    tier: 'workouts',
    name: 'Workouts',
    summary: 'Track your training and watch your strength grow.',
    includes: ['Workouts and splits', 'Records and progress', 'Friends and group workouts'],
    icon: 'activity',
  },
  {
    tier: 'workouts_nutrition',
    name: 'Workouts + Nutrition',
    summary: 'Everything in Workouts, plus tracking what you eat.',
    includes: ['Everything in Workouts', 'Food logging and macros', 'Calorie and macro targets'],
    icon: 'pie-chart',
  },
  {
    tier: 'everything',
    name: 'Everything',
    summary: 'Workouts and Nutrition, plus Trainer Mode for coaching clients.',
    includes: ['Everything in Workouts + Nutrition', 'Trainer Mode: clients, logging, sessions'],
    icon: 'star',
  },
];

export function membershipOption(tier: MembershipTier): MembershipOption {
  return MEMBERSHIP_OPTIONS.find((option) => option.tier === tier) ?? MEMBERSHIP_OPTIONS[2];
}

/** Whether a membership includes Nutrition: logging, targets, history and their notifications. */
export function includesNutrition(tier: MembershipTier): boolean {
  return tier === 'workouts_nutrition' || tier === 'everything';
}

/** Whether a membership includes Trainer Mode: the Trainer Workspace and coaching clients. */
export function includesTrainerMode(tier: MembershipTier): boolean {
  return tier === 'everything';
}
