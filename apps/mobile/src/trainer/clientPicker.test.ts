import type { TrainerClient } from '../lib/api';
import {
  clientName,
  filterClientsByName,
  groupClientsByLetter,
  pickableClients,
} from './clientPicker';

function client(
  id: string,
  displayName: string | null,
  overrides: Partial<TrainerClient> = {},
): TrainerClient {
  return {
    clientId: id,
    inviteId: null,
    email: null,
    status: 'active',
    awaitingClaim: false,
    source: 'managed',
    displayName,
    birthday: null,
    heightValue: null,
    heightUnit: 'cm',
    weightValue: null,
    weightUnit: 'kg',
    ...overrides,
  };
}

describe('pickableClients', () => {
  it('offers only active clients who are not already in the group, sorted by name', () => {
    const clients = [
      client('c1', 'Zoe'),
      client('c2', 'adam'),
      client('c3', 'Mia'),
      client('c4', 'Pending Pat', { status: 'pending' }),
      client('c5', 'Invite Only', { clientId: null, inviteId: 'i1', status: 'invited' }),
    ];
    const picked = pickableClients(clients, new Set(['c3']));
    expect(picked.map((c) => c.clientId)).toEqual(['c2', 'c1']);
  });

  it('keeps a long list ordered and complete (100+ clients)', () => {
    const many = Array.from({ length: 150 }, (_, i) =>
      client(`c${i}`, `Client ${String(i).padStart(3, '0')}`),
    );
    const picked = pickableClients(many, new Set());
    expect(picked).toHaveLength(150);
    expect(clientName(picked[0])).toBe('Client 000');
    expect(clientName(picked[149])).toBe('Client 149');
  });
});

describe('filterClientsByName', () => {
  it('matches anywhere in the name, ignoring case and spaces at the ends', () => {
    const clients = [client('c1', 'Sam Lee'), client('c2', 'Ana Samson'), client('c3', 'Pat')];
    expect(filterClientsByName(clients, '  SAM ').map((c) => c.clientId)).toEqual(['c1', 'c2']);
  });

  it('shows everyone for an empty search', () => {
    const clients = [client('c1', 'Sam'), client('c2', 'Pat')];
    expect(filterClientsByName(clients, '')).toHaveLength(2);
  });
});

describe('groupClientsByLetter', () => {
  it('makes one section per letter, and puts names that do not start with a letter under #', () => {
    const sorted = pickableClients(
      [
        client('c1', 'Ana'),
        client('c2', 'Ben'),
        client('c3', 'Amy'),
        client('c4', '3 Stars'),
        client('c5', null),
      ],
      new Set(),
    );
    const sections = groupClientsByLetter(sorted);
    expect(sections.map((s) => s.letter)).toEqual(['#', 'A', 'B', 'U']);
    expect(sections.find((s) => s.letter === 'A')?.data).toHaveLength(2);
  });
});
