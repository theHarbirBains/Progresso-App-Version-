import { gripKindOf, handleTypeOf, HANDLE_TYPES } from './gripAndHandle';

describe('grip and handle', () => {
  it('reads every grip the built-ins record as neutral, pronated or supinated', () => {
    expect(gripKindOf('Neutral')).toBe('neutral');
    expect(gripKindOf('Close neutral')).toBe('neutral');
    expect(gripKindOf('Wide neutral')).toBe('neutral');
    expect(gripKindOf('Vertical handles')).toBe('neutral');
    expect(gripKindOf('Overhand')).toBe('pronated');
    expect(gripKindOf('Wide overhand')).toBe('pronated');
    expect(gripKindOf('Angled overhand')).toBe('pronated');
    expect(gripKindOf('Horizontal handles')).toBe('pronated');
    expect(gripKindOf('Underhand')).toBe('supinated');
  });

  it("reads a person's own grip the same, and leaves what isn't one of the three", () => {
    expect(gripKindOf('Neutral grip')).toBe('neutral');
    expect(gripKindOf('underhand')).toBe('supinated');
    expect(gripKindOf('Mixed grip')).toBeNull();
    expect(gripKindOf('Wide grip')).toBeNull();
    expect(gripKindOf('Feet high')).toBeNull();
    expect(gripKindOf(null)).toBeNull();
  });

  it('reads each handle the built-ins record, and nothing that is not a handle', () => {
    expect(handleTypeOf('D-handle')).toBe('d_handle');
    expect(handleTypeOf('D-handles')).toBe('d_handle');
    expect(handleTypeOf('Straight bar')).toBe('straight_bar');
    expect(handleTypeOf('Lat pulldown bar')).toBe('lat_pulldown_bar');
    // A V-handle (the rows') and a V-bar (the pushdown's angled bar) are different handles.
    expect(handleTypeOf('V-handle')).toBe('v_handle');
    expect(handleTypeOf('V-bar')).toBe('v_bar');
    expect(handleTypeOf('MAG grip')).toBe('mag_grip');
    expect(handleTypeOf('Cable ends')).toBe('cable_ends');
    expect(handleTypeOf('Medicine ball')).toBeNull();
    expect(handleTypeOf('Landmine')).toBeNull();
    expect(handleTypeOf('')).toBeNull();
    expect(new Set(HANDLE_TYPES).size).toBe(HANDLE_TYPES.length);
  });
});
