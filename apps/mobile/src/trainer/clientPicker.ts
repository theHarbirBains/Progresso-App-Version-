import { OTHER_LETTER } from '../exercises/exerciseLibraryGrouping';
import type { TrainerClient } from '../lib/api';

export interface ClientSection {
  letter: string;
  data: TrainerClient[];
}

export const UNNAMED_CLIENT = 'Unnamed client';

export function clientName(client: TrainerClient): string {
  return client.displayName?.trim() || UNNAMED_CLIENT;
}

/**
 * The clients that can be added to a group: active, with an account or tracked,
 * and not already in the group. Sorted by name, so a long list reads in order.
 */
export function pickableClients(
  clients: TrainerClient[],
  alreadyInGroup: Set<string>,
): TrainerClient[] {
  return clients
    .filter(
      (client) =>
        client.status === 'active' &&
        client.clientId !== null &&
        !alreadyInGroup.has(client.clientId),
    )
    .sort((a, b) => clientName(a).localeCompare(clientName(b), undefined, { sensitivity: 'base' }));
}

/** Matches the name anywhere in it, ignoring case and surrounding spaces. An empty query matches everyone. */
export function filterClientsByName(clients: TrainerClient[], query: string): TrainerClient[] {
  const needle = query.trim().toLowerCase();
  if (needle === '') return clients;
  return clients.filter((client) => clientName(client).toLowerCase().includes(needle));
}

/** Sections by first letter, in the order the clients are given (already sorted). Non-letters go under #. */
export function groupClientsByLetter(clients: TrainerClient[]): ClientSection[] {
  const sections: ClientSection[] = [];
  const byLetter = new Map<string, ClientSection>();
  for (const client of clients) {
    const first = clientName(client).charAt(0).toUpperCase();
    const letter = /^[A-Z]$/.test(first) ? first : OTHER_LETTER;
    const existing = byLetter.get(letter);
    if (existing) {
      existing.data.push(client);
    } else {
      const section: ClientSection = { letter, data: [client] };
      byLetter.set(letter, section);
      sections.push(section);
    }
  }
  return sections;
}
