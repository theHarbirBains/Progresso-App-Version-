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

  it('never lists Clients in the side menu, for anyone; trainers reach it from Trainer Access', () => {
    expect(routesIn(appMenuSectionsFor(false), 'TRAINING')).not.toContain('TrainerClients');
    expect(routesIn(appMenuSectionsFor(true), 'TRAINING')).not.toContain('TrainerClients');
  });

  it('shows the same menu to a trainer as to everyone else', () => {
    expect(appMenuSectionsFor(true)).toEqual(appMenuSectionsFor(false));
  });
});
