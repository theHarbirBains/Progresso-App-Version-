import { appMenuSectionsFor } from './appMenuSections';

function routesIn(sections: ReturnType<typeof appMenuSectionsFor>, title: string): string[] {
  const section = sections.find((s) => s.title === title);
  return (section?.items ?? []).map((item) => ('route' in item ? item.route : item.label));
}

describe('appMenuSectionsFor', () => {
  it('shows Trainer Access to everyone, under Social', () => {
    expect(routesIn(appMenuSectionsFor(false), 'SOCIAL')).toContain('TrainerAccess');
    expect(routesIn(appMenuSectionsFor(true), 'SOCIAL')).toContain('TrainerAccess');
  });

  it('adds Clients under Training only for a trainer', () => {
    expect(routesIn(appMenuSectionsFor(false), 'TRAINING')).not.toContain('TrainerClients');
    expect(routesIn(appMenuSectionsFor(true), 'TRAINING')).toContain('TrainerClients');
  });

  it('leaves every other entry in place for a trainer, with Clients at the end of Training', () => {
    const plain = appMenuSectionsFor(false).flatMap((s) => s.items.map((i) => i.label));
    const trainer = appMenuSectionsFor(true).flatMap((s) => s.items.map((i) => i.label));
    expect(trainer.filter((label) => label !== 'Clients')).toEqual(plain);
    // Training has five entries, so Clients is the sixth.
    expect(trainer.indexOf('Clients')).toBe(5);
  });
});
