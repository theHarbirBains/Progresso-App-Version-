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

describe('machineDetailsOf', () => {
  it("reads an embedded exercise's photo, gym and handle", () => {
    expect(
      machineDetailsOf({
        photo_url: 'https://example.com/a.jpg',
        gym: 'Home',
        attachment: null,
        load_type: 'single_stack',
        pulley: 'heavier',
      }),
    ).toEqual({
      photoUrl: 'https://example.com/a.jpg',
      gym: 'Home',
      attachment: null,
      loadType: 'single_stack',
      pulley: 'heavier',
    });
  });

  it('has none when the exercise could not be read', () => {
    expect(machineDetailsOf(null)).toEqual({
      photoUrl: null,
      gym: null,
      attachment: null,
      loadType: null,
      pulley: null,
    });
  });
});
