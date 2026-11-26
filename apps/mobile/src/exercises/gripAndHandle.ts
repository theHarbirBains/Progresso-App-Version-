// The Exercise Library's Grip and Handle filters (explicitly requested, 2026-11-26), read from what
// each exercise records -- its grip (`exercises.grip`) and what's held (`exercises.attachment`) --
// never guessed from its name. An exercise that records neither is under All Grips / All Handles
// only.

/** How the hands hold it: palms facing each other, down, or up. */
export const GRIP_KINDS = ['neutral', 'pronated', 'supinated'] as const;
export type GripKind = (typeof GRIP_KINDS)[number];

export const GRIP_KIND_LABELS: Record<GripKind, string> = {
  neutral: 'Neutral',
  pronated: 'Pronated',
  supinated: 'Supinated',
};

/**
 * A recorded grip as one of the three: the built-ins' "Neutral", "Close neutral", "Wide neutral"
 * and a machine's vertical handles are neutral; "Overhand" (wide, medium, angled) and a machine's
 * horizontal handles pronated; "Underhand" supinated -- and a person's own "Neutral grip",
 * "Overhand" or "Underhand" the same. A mixed grip, a width alone ("Wide grip") or where the feet
 * go is none of them.
 */
export function gripKindOf(grip: string | null | undefined): GripKind | null {
  const text = grip?.trim().toLowerCase() ?? '';
  if (!text) return null;
  if (text.includes('mixed')) return null;
  if (text.includes('neutral') || text.includes('vertical handle')) return 'neutral';
  if (text.includes('underhand') || text.includes('supinated')) return 'supinated';
  if (
    text.includes('overhand') ||
    text.includes('pronated') ||
    text.includes('horizontal handle')
  ) {
    return 'pronated';
  }
  return null;
}

/**
 * What's held on a cable, a machine or a bar: each kind the built-in library has, in the order a
 * filter lists them. Equipment that isn't a handle -- a landmine, a medicine ball, a plate, a
 * suspension trainer -- isn't one.
 */
export const HANDLE_TYPES = [
  'straight_bar',
  'lat_pulldown_bar',
  'ez_bar',
  'rope',
  'd_handle',
  'v_handle',
  'v_bar',
  'wide_neutral_bar',
  'narrow_neutral_handle',
  'mag_grip',
  'trap_bar',
  'ankle_strap',
  'cable_ends',
] as const;
export type HandleType = (typeof HANDLE_TYPES)[number];

export const HANDLE_TYPE_LABELS: Record<HandleType, string> = {
  straight_bar: 'Straight Bar',
  lat_pulldown_bar: 'Lat Pulldown Bar',
  ez_bar: 'EZ Bar',
  rope: 'Rope',
  d_handle: 'D-Handle',
  v_handle: 'V-Handle',
  v_bar: 'V-Bar',
  wide_neutral_bar: 'Wide Neutral-Grip Bar',
  narrow_neutral_handle: 'Narrow Neutral-Grip Handle',
  mag_grip: 'MAG Grip',
  trap_bar: 'Trap Bar',
  ankle_strap: 'Ankle Strap',
  cable_ends: 'Cable Ends (No Handle)',
};

/** Each recorded attachment, lower case: the built-ins' words, and Create Exercise's choices. */
const ATTACHMENT_HANDLES: Record<string, HandleType> = {
  'straight bar': 'straight_bar',
  'lat pulldown bar': 'lat_pulldown_bar',
  'ez bar': 'ez_bar',
  rope: 'rope',
  'd-handle': 'd_handle',
  'd-handles': 'd_handle',
  'v-handle': 'v_handle',
  'v-bar': 'v_bar',
  'wide neutral-grip bar': 'wide_neutral_bar',
  'narrow neutral-grip handle': 'narrow_neutral_handle',
  'mag grip': 'mag_grip',
  'trap bar': 'trap_bar',
  'ankle strap': 'ankle_strap',
  'cable ends': 'cable_ends',
};

/** A recorded attachment's handle type, or null when it isn't one of them. */
export function handleTypeOf(attachment: string | null | undefined): HandleType | null {
  const text = attachment?.trim().toLowerCase() ?? '';
  return text ? (ATTACHMENT_HANDLES[text] ?? null) : null;
}
