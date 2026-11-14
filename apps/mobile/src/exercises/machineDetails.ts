/**
 * What tells one machine from another that looks the same -- its photo, the gym it's at and the
 * bar or handle it's done with (Create Exercise's About This Machine) -- as the Exercise Library
 * shows them. Every place a top set or record is shown carries these with the exercise, so two
 * machines of the same name read apart there too. All optional: built-ins have none, and most
 * custom exercises only some.
 */
export interface MachineDetails {
  photoUrl?: string | null;
  gym?: string | null;
  attachment?: string | null;
}

/** The columns an `exercises(...)` embed reads them from. */
export const MACHINE_COLUMNS = 'photo_url, gym, attachment';

/** An embedded exercise's details, or none when it couldn't be read. */
export function machineDetailsOf(
  exercise: { photo_url?: string | null; gym?: string | null; attachment?: string | null } | null,
): Required<MachineDetails> {
  return {
    photoUrl: exercise?.photo_url ?? null,
    gym: exercise?.gym ?? null,
    attachment: exercise?.attachment ?? null,
  };
}

/**
 * An exercise's line as the library shows it: what leads it (its muscle, its movement), then its
 * gym and handle -- "Back · Fit4Less Downtown · V-handle". Empty parts are left out; null when
 * nothing is left.
 */
export function machineLine(
  details: MachineDetails,
  ...leading: (string | null | undefined)[]
): string | null {
  const parts = [...leading, details.gym, details.attachment].filter(
    (part): part is string => typeof part === 'string' && part.trim().length > 0,
  );
  return parts.length > 0 ? parts.join(' · ') : null;
}
