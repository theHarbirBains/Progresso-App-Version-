import { LOAD_TYPE_LABELS, pulleyText, type LoadType, type Pulley } from './machineLoad';

/**
 * What tells one machine from another that looks the same -- its photo, the gym it's at, the bar
 * or handle it's done with, how it's loaded and its pulley (Create Exercise's About This Machine)
 * -- as the Exercise Library shows them. Every place a top set or record is shown carries these with the exercise, so two
 * machines of the same name read apart there too. All optional: built-ins have none, and most
 * custom exercises only some.
 */
export interface MachineDetails {
  photoUrl?: string | null;
  gym?: string | null;
  attachment?: string | null;
  loadType?: LoadType | null;
  pulley?: Pulley | null;
}

/** The columns an `exercises(...)` embed reads them from. */
export const MACHINE_COLUMNS = 'photo_url, gym, attachment, load_type, pulley';

/** An embedded exercise's details, or none when it couldn't be read. */
export function machineDetailsOf(
  exercise: {
    photo_url?: string | null;
    gym?: string | null;
    attachment?: string | null;
    load_type?: LoadType | null;
    pulley?: Pulley | null;
  } | null,
): Required<MachineDetails> {
  return {
    photoUrl: exercise?.photo_url ?? null,
    gym: exercise?.gym ?? null,
    attachment: exercise?.attachment ?? null,
    loadType: exercise?.load_type ?? null,
    pulley: exercise?.pulley ?? null,
  };
}

/**
 * An exercise's line as the library shows it: what leads it (its muscle, its movement), then its
 * gym, handle, how it's loaded and its pulley -- "Back · Fit4Less Downtown · V-handle · Double
 * stack · Lighter pulley". Empty parts are left out; null when nothing is left.
 */
export function machineLine(
  details: MachineDetails,
  ...leading: (string | null | undefined)[]
): string | null {
  const parts = [
    ...leading,
    details.gym,
    details.attachment,
    details.loadType ? LOAD_TYPE_LABELS[details.loadType] : null,
    details.pulley ? pulleyText(details.pulley) : null,
  ].filter((part): part is string => typeof part === 'string' && part.trim().length > 0);
  return parts.length > 0 ? parts.join(' · ') : null;
}
