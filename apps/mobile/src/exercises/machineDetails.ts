import { EQUIPMENT_LABELS, type Equipment } from './equipment';
import {
  LOAD_TYPE_LABELS,
  pulleyPositionText,
  pulleyText,
  type LoadType,
  type Pulley,
  type PulleyPosition,
} from './machineLoad';

/**
 * What tells one machine from another that looks the same -- its photo, the gym it's at, what it's
 * done with, how it's held (the grip) and what's held (the attachment), how it's loaded, where its
 * cable starts and an old heavier or lighter pulley (Create Exercise's setup) -- as the Exercise
 * Library shows them. Every place a top set or record is shown carries these with the exercise, so
 * two machines of the same name read apart there too. All optional: built-ins have none, and most
 * custom exercises only some.
 */
export interface MachineDetails {
  photoUrl?: string | null;
  gym?: string | null;
  equipment?: Equipment | null;
  grip?: string | null;
  attachment?: string | null;
  loadType?: LoadType | null;
  pulleyPosition?: PulleyPosition | null;
  pulley?: Pulley | null;
}

/** The columns an `exercises(...)` embed reads them from. */
export const MACHINE_COLUMNS =
  'photo_url, gym, equipment, grip, attachment, load_type, pulley_position, pulley';

/** An embedded exercise's details, or none when it couldn't be read. */
export function machineDetailsOf(
  exercise: {
    photo_url?: string | null;
    gym?: string | null;
    equipment?: Equipment | null;
    grip?: string | null;
    attachment?: string | null;
    load_type?: LoadType | null;
    pulley_position?: PulleyPosition | null;
    pulley?: Pulley | null;
  } | null,
): Required<MachineDetails> {
  return {
    photoUrl: exercise?.photo_url ?? null,
    gym: exercise?.gym ?? null,
    equipment: exercise?.equipment ?? null,
    grip: exercise?.grip ?? null,
    attachment: exercise?.attachment ?? null,
    loadType: exercise?.load_type ?? null,
    pulleyPosition: exercise?.pulley_position ?? null,
    pulley: exercise?.pulley ?? null,
  };
}

/**
 * An exercise's line as the library shows it: what leads it (its muscle, its movement), then its
 * equipment, gym, grip, attachment, how it's loaded and its pulley -- "Triceps · Cable ·
 * Fit4Less Downtown · Neutral grip · Rope · Single stack · High pulley". Empty parts are left out;
 * null when nothing is left.
 */
export function machineLine(
  details: MachineDetails,
  ...leading: (string | null | undefined)[]
): string | null {
  const parts = [
    ...leading,
    details.equipment ? EQUIPMENT_LABELS[details.equipment] : null,
    details.gym,
    details.grip,
    details.attachment,
    details.loadType ? LOAD_TYPE_LABELS[details.loadType] : null,
    details.pulleyPosition ? pulleyPositionText(details.pulleyPosition) : null,
    details.pulley ? pulleyText(details.pulley) : null,
  ].filter((part): part is string => typeof part === 'string' && part.trim().length > 0);
  return parts.length > 0 ? parts.join(' · ') : null;
}
