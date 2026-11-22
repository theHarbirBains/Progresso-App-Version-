// The share card's display-only wording: an exercise's name made shorter where that can't confuse
// it with another, and a title for a workout without a name of its own. Pure. Nothing here ever
// changes a stored name.

/** An exercise's name without a closing parenthetical: "Machine Shoulder Press (Double Stack)". */
const TRAILING_PARENTHETICAL = /\s*\(([^()]*)\)\s*$/;

const key = (name: string) => name.trim().toLowerCase();

/**
 * Each exercise's name as the card shows it, in the same order: a trailing parenthetical is left
 * off ("Machine Shoulder Press (Double Stack)" -> "Machine Shoulder Press") only where what's left
 * is no other exercise's name on the card, shortened or not -- so two machines, or two setups of
 * one exercise, never read the same. A variation written into the name itself ("Seated Cable Row
 * -- Rope Attachment") is part of it and stays. Anything else is the name as it is, wrapped.
 */
export function shareDisplayNames(names: readonly string[]): string[] {
  const short = names.map((name) => name.replace(TRAILING_PARENTHETICAL, '').trim());
  const fullKeys = names.map(key);
  return names.map((name, index) => {
    const candidate = short[index];
    if (!candidate || candidate === name.trim()) return name.trim();
    const clashes = names.some(
      (_, other) =>
        other !== index &&
        (key(short[other]) === key(candidate) || fullKeys[other] === key(candidate)),
    );
    return clashes ? name.trim() : candidate;
  });
}

/** Workout names that say nothing about the workout: the card says what was trained instead. */
const GENERIC_NAME =
  /^(workout|my workout|quick workout|new workout|custom workout|untitled( workout)?)$/i;

/**
 * The card's title: the workout's own name, or -- with none, or a generic one -- what it trained
 * ("Shoulders & Arms", "Chest, Back & Biceps"), "Cardio" for cardio alone, else "Workout".
 */
export function shareTitle(name: string, muscles: readonly string[], hasCardio: boolean): string {
  const own = name.trim();
  if (own && !GENERIC_NAME.test(own)) return own;
  if (muscles.length === 1) return muscles[0];
  if (muscles.length > 1)
    return `${muscles.slice(0, -1).join(', ')} & ${muscles[muscles.length - 1]}`;
  return hasCardio ? 'Cardio' : own || 'Workout';
}
