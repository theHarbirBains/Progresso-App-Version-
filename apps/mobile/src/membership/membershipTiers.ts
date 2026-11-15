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
  /** The parts of the app it includes, each with its every feature (MEMBERSHIP_AREAS). */
  areas: MembershipArea[];
}

/** A part of the app a membership includes. */
export type MembershipArea = 'workouts' | 'nutrition' | 'trainer';

export interface MembershipAreaDetails {
  area: MembershipArea;
  title: string;
  icon: keyof typeof Feather.glyphMap;
  /** Everything it gives, one plain line each -- the membership cards' jot notes. */
  features: string[];
}

/** Each part of the app, and everything in it -- what the membership cards list. */
export const MEMBERSHIP_AREAS: MembershipAreaDetails[] = [
  {
    area: 'workouts',
    title: 'Workouts',
    icon: 'activity',
    features: [
      'Workout splits: start from a ready-made plan or build your own, with each day planned',
      'Live workout tracking: sets save as you type, with timers for timed sets',
      'Progression cues that tell you when to go up in weight',
      'An exercise library, plus your own machines with their photo, gym, grip, weight type and pulley',
      'Personal records: rep PRs, true 1RMs, top sets, most reps and longest holds',
      'Progress: strength charts, weekly summaries, muscle volume and Apple Health steps',
      'Workout history and a calendar of every session',
      'Achievements, Achievement Points and lifetime ranks from Bronze to Legacy',
      'Friends: follow people, a Friends feed, likes, comments and profiles',
      'Find friends from your contacts, and train together in group workouts',
      'Reminders, home-screen widgets and a Lock Screen card while you train',
      'Share cards for your workouts',
    ],
  },
  {
    area: 'nutrition',
    title: 'Nutrition',
    icon: 'pie-chart',
    features: [
      'Food logging: search foods, scan barcodes, or describe a meal and let AI estimate it',
      'Quick macro entry, for when you only know the numbers',
      'A Food Library of your foods, saved meals and recipes, with your usual and recent foods',
      'Daily calorie, protein, carb and fat targets, with a calculator to set them',
      'A weekly calorie budget, nutrition history, and planning days ahead',
      'Copy yesterday in one tap',
      "Meal and check-in reminders, and a Today's Nutrition widget",
      'Nutrition achievements that add to your rank',
    ],
  },
  {
    area: 'trainer',
    title: 'Trainer Mode',
    icon: 'briefcase',
    features: [
      'A Trainer Workspace with your clients and their activity',
      "Track clients who don't have an account yet; they claim their history later with a code",
      'Log workouts for clients, or run live sessions with them',
      "Set each client's rep ranges, and fix a top set logged wrong (every change is recorded)",
      'Share your custom exercises with your clients, and see theirs',
    ],
  },
];

export function membershipArea(area: MembershipArea): MembershipAreaDetails {
  return MEMBERSHIP_AREAS.find((details) => details.area === area)!;
}

export const MEMBERSHIP_OPTIONS: MembershipOption[] = [
  {
    tier: 'workouts',
    name: 'Workouts',
    summary: 'Track your training and watch your strength grow.',
    includes: ['Workouts and splits', 'Records and progress', 'Friends and group workouts'],
    icon: 'activity',
    areas: ['workouts'],
  },
  {
    tier: 'workouts_nutrition',
    name: 'Workouts + Nutrition',
    summary: 'Your training and what you eat, side by side.',
    includes: ['Everything in Workouts', 'Food logging and macros', 'Calorie and macro targets'],
    icon: 'pie-chart',
    areas: ['workouts', 'nutrition'],
  },
  {
    tier: 'everything',
    name: 'Everything',
    summary: 'For coaches: train your clients in Progresso too.',
    includes: ['Everything in Workouts + Nutrition', 'Trainer Mode: clients, logging, sessions'],
    icon: 'star',
    areas: ['workouts', 'nutrition', 'trainer'],
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
