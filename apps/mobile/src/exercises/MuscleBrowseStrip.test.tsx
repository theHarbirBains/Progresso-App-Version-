import { fireEvent, render, screen } from '@testing-library/react-native';
import { figureSexFor, MuscleBrowseStrip } from './MuscleBrowseStrip';
import { MUSCLE_GROUPS } from './muscleGroups';
import { MUSCLE_TILES } from './muscleTiles.generated';

let mockGender: string | null | undefined = null;
jest.mock('../profile/profileContext', () => ({
  useProfileIfAny: () => (mockGender === undefined ? null : { gender: mockGender }),
}));

beforeEach(() => {
  mockGender = null;
});

describe('MuscleBrowseStrip', () => {
  it('has a man’s and a woman’s picture for every muscle group with built-ins', () => {
    const drawn = MUSCLE_GROUPS.filter((group) => group !== 'full_body' && group !== 'other');
    for (const sex of ['male', 'female'] as const) {
      expect(Object.keys(MUSCLE_TILES[sex]).sort()).toEqual([...drawn].sort());
    }
  });

  it('shows a woman the women’s figures, and a man -- or anyone else -- the men’s', () => {
    expect(figureSexFor('female')).toBe('female');
    expect(figureSexFor('male')).toBe('male');
    expect(figureSexFor('non_binary')).toBe('male');
    expect(figureSexFor(null)).toBe('male');

    mockGender = 'female';
    const { unmount } = render(
      <MuscleBrowseStrip counts={{ chest: 3 }} onChoose={jest.fn()} accentColor="#D99A50" />,
    );
    expect(screen.getByTestId('muscle-browse-chest-female')).toBeTruthy();
    unmount();

    mockGender = 'male';
    render(<MuscleBrowseStrip counts={{ chest: 3 }} onChoose={jest.fn()} accentColor="#D99A50" />);
    expect(screen.getByTestId('muscle-browse-chest-male')).toBeTruthy();
  });

  it('names each group with its real count, never the picture’s, and a tap chooses it', () => {
    const onChoose = jest.fn();
    render(
      <MuscleBrowseStrip
        counts={{ back: 7, glutes: 2, full_body: 1 }}
        onChoose={onChoose}
        accentColor="#D99A50"
      />,
    );
    expect(screen.getByTestId('muscle-browse-back')).toHaveTextContent(/Back\s*7/);
    expect(screen.getByTestId('muscle-browse-glutes')).toHaveTextContent(/Glutes\s*2/);
    // Full Body has no figure: a glyph, still with its name and count.
    expect(screen.queryByTestId('muscle-browse-full_body-male')).toBeNull();
    expect(screen.getByTestId('muscle-browse-full_body')).toHaveTextContent(/Full Body\s*1/);
    expect(screen.queryByTestId('muscle-browse-chest')).toBeNull();
    fireEvent.press(screen.getByTestId('muscle-browse-back'));
    expect(onChoose).toHaveBeenCalledWith('back');
  });

  it('shows nothing when no group has exercises', () => {
    render(<MuscleBrowseStrip counts={{}} onChoose={jest.fn()} accentColor="#D99A50" />);
    expect(screen.queryByTestId('muscle-browse')).toBeNull();
  });
});
