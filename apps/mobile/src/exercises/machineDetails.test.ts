import { machineDetailsOf, machineLine } from './machineDetails';

describe('machineLine', () => {
  it('names the gym and handle after what leads the line, as the library row does', () => {
    expect(
      machineLine({ gym: 'Fit4Less Downtown', attachment: 'V-handle' }, 'Back', 'Bilateral'),
    ).toBe('Back · Bilateral · Fit4Less Downtown · V-handle');
  });

  it('names how it is loaded and its pulley after its handle', () => {
    expect(
      machineLine(
        { gym: 'Downtown', attachment: 'Rope', loadType: 'double_stack', pulley: 'lighter' },
        'Triceps',
      ),
    ).toBe('Triceps · Downtown · Rope · Double stack · Lighter pulley');
    expect(machineLine({ loadType: 'plate_loaded' }, 'Chest')).toBe('Chest · Plate loaded');
  });

  it('leaves out what is missing or blank', () => {
    expect(machineLine({ gym: null, attachment: 'V-handle' }, 'Back')).toBe('Back · V-handle');
    expect(machineLine({ gym: '  ' }, 'Back', null)).toBe('Back');
  });

  it('is null when there is nothing to say', () => {
    expect(machineLine({})).toBeNull();
    expect(machineLine({ gym: null, attachment: null })).toBeNull();
  });
});

describe('machineLine with the setup', () => {
  it('reads equipment, gym, grip, attachment, weight type and pulley position in turn', () => {
    expect(
      machineLine(
        {
          equipment: 'cable',
          gym: 'Downtown',
          grip: 'Neutral grip',
          attachment: 'Rope',
          loadType: 'single_stack',
          pulleyPosition: 'high',
        },
        'Triceps',
      ),
    ).toBe('Triceps · Cable · Downtown · Neutral grip · Rope · Single stack · High pulley');
  });

  it('says nothing for an other or unknown pulley, and keeps an old heavier or lighter one', () => {
    expect(machineLine({ pulleyPosition: 'other' })).toBeNull();
    expect(machineLine({ pulley: 'lighter' })).toBe('Lighter pulley');
  });
});

describe('machineDetailsOf', () => {
  it("reads an embedded exercise's photo, gym and handle", () => {
    expect(
      machineDetailsOf({
        photo_url: 'https://example.com/a.jpg',
        gym: 'Home',
        attachment: null,
        load_type: 'single_stack',
        equipment: 'cable',
        grip: 'Wide grip',
        pulley_position: 'high',
        pulley: 'heavier',
      }),
    ).toEqual({
      photoUrl: 'https://example.com/a.jpg',
      gym: 'Home',
      grip: 'Wide grip',
      attachment: null,
      loadType: 'single_stack',
      equipment: 'cable',
      pulleyPosition: 'high',
      pulley: 'heavier',
    });
  });

  it('has none when the exercise could not be read', () => {
    expect(machineDetailsOf(null)).toEqual({
      photoUrl: null,
      gym: null,
      grip: null,
      attachment: null,
      loadType: null,
      equipment: null,
      pulleyPosition: null,
      pulley: null,
    });
  });
});
