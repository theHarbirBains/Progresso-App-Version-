import type { MeasurementType } from './movementTypes';

/**
 * What an exercise is done with (`exercises.equipment`, optional), and the setup details worth
 * asking about for it. Create Exercise asks only what fits: a dumbbell curl is a name, a muscle and
 * a photo, with a grip or a note a tap away; a cable pushdown asks for its gym, grip, attachment,
 * weight type, pulley position and setup notes; a machine for its gym, grip, weight type and setup.
 */
export const EQUIPMENT = [
  'dumbbell',
  'barbell',
  'kettlebell',
  'cable',
  'machine',
  'bodyweight',
  'other',
] as const;
export type Equipment = (typeof EQUIPMENT)[number];

export const EQUIPMENT_LABELS: Record<Equipment, string> = {
  dumbbell: 'Dumbbell',
  barbell: 'Barbell',
  kettlebell: 'Kettlebell',
  cable: 'Cable',
  machine: 'Machine',
  bodyweight: 'Bodyweight',
  other: 'Other',
};

/** The optional setup details an exercise can record. */
export type SetupField =
  'gym' | 'grip' | 'attachment' | 'loadType' | 'pulleyPosition' | 'setupDetails';

/**
 * How a detail is offered: shown at once, behind More Details (there when wanted, out of the way
 * otherwise), or not at all -- it doesn't apply.
 */
export type FieldVisibility = 'shown' | 'more' | 'hidden';

type FieldRules = Record<SetupField, FieldVisibility>;

const FREE_WEIGHT: FieldRules = {
  gym: 'more',
  grip: 'more',
  attachment: 'hidden',
  loadType: 'hidden',
  pulleyPosition: 'hidden',
  setupDetails: 'more',
};

const RULES: Record<Equipment | 'none', FieldRules> = {
  dumbbell: FREE_WEIGHT,
  kettlebell: FREE_WEIGHT,
  // How wide the hands go on the bar changes a bench press or a row, so the grip is asked.
  barbell: { ...FREE_WEIGHT, grip: 'shown' },
  bodyweight: FREE_WEIGHT,
  cable: {
    gym: 'shown',
    grip: 'shown',
    attachment: 'shown',
    loadType: 'shown',
    pulleyPosition: 'shown',
    setupDetails: 'shown',
  },
  // A machine's handles are its own: an attachment only when there's one to say.
  machine: {
    gym: 'shown',
    grip: 'shown',
    attachment: 'more',
    loadType: 'shown',
    pulleyPosition: 'hidden',
    setupDetails: 'shown',
  },
  other: {
    gym: 'more',
    grip: 'more',
    attachment: 'more',
    loadType: 'more',
    pulleyPosition: 'hidden',
    setupDetails: 'more',
  },
  // Nothing chosen yet: every detail a tap away, none in the way. A pulley's position is only ever
  // asked of a cable exercise.
  none: {
    gym: 'more',
    grip: 'more',
    attachment: 'more',
    loadType: 'more',
    pulleyPosition: 'hidden',
    setupDetails: 'more',
  },
};

/**
 * How each setup detail is offered for this equipment. Without a weight (reps or a time), there's
 * no weight type to ask about.
 */
export function setupFieldsFor(
  equipment: Equipment | null,
  measurementType: MeasurementType,
): FieldRules {
  const rules = RULES[equipment ?? 'none'];
  return measurementType === 'weight_reps' ? rules : { ...rules, loadType: 'hidden' };
}

/**
 * Whether a detail shows: when it applies, or is behind More Details and that's open -- and always
 * when it already has a value, so nothing saved is ever out of sight (and so never kept without
 * the person seeing it).
 */
export function setupFieldShown(
  visibility: FieldVisibility,
  moreOpen: boolean,
  hasValue: boolean,
): boolean {
  return hasValue || visibility === 'shown' || (visibility === 'more' && moreOpen);
}

/**
 * Two custom exercises are the same setup -- what makes one machine (the database's
 * exercise_machine_key, less the photo) -- when these match, case and spaces aside. Setup notes
 * aren't part of it: a seat moved a notch is the same exercise.
 */
export interface SetupIdentity {
  name: string;
  equipment: Equipment | null;
  gym: string | null;
  grip: string | null;
  attachment: string | null;
  loadType: string | null;
  pulleyPosition: string | null;
}

function text(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

/** The setup an exercise is, as a comparable key -- its name included. */
export function setupKey(setup: SetupIdentity): string {
  return [
    text(setup.name),
    setup.equipment ?? '',
    text(setup.gym),
    text(setup.grip),
    text(setup.attachment),
    setup.loadType ?? '',
    setup.pulleyPosition ?? '',
  ].join('\u001f');
}

/** Whether the setup itself -- anything but the name -- differs. */
export function setupChanged(before: SetupIdentity, after: SetupIdentity): boolean {
  return setupKey({ ...before, name: '' }) !== setupKey({ ...after, name: '' });
}
