import { StyleSheet } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { ProfileContext } from '../profile/profileContext';
import { groupAt, levelColors, MuscleActivityFigure } from './MuscleActivityFigure';
import { MUSCLE_HEATMAP, TAP_CODES } from './muscleHeatmap.generated';
import { muscleActivity } from './muscleActivity';

const NOW = new Date(2026, 10, 25, 15, 0);
const activity = muscleActivity(
  [
    {
      workoutId: 'w1',
      performedAt: new Date(2026, 10, 25, 9).toISOString(),
      exerciseId: 'bench',
      exerciseName: 'Bench Press',
      muscleGroup: 'chest',
      measurementType: 'weight_reps',
      sets: [{ weightKg: 100, reps: 5, isDrop: false }],
    },
  ],
  7,
  NOW,
  () => [],
);

/** A tap at a point of the figure, 0-1 across and down, on a figure 300 tall. */
function tapAt(x: number, y: number) {
  const figure = screen.getByTestId('muscle-activity-figure-front');
  const { width, height } = figure.props.style as { width: number; height: number };
  fireEvent.press(figure, { nativeEvent: { locationX: x * width, locationY: y * height } });
}

describe('MuscleActivityFigure', () => {
  it('chooses the group of the muscle tapped -- or the nearest, in a gap -- and nothing off the body', () => {
    const onSelect = jest.fn();
    render(
      <MuscleActivityFigure
        activity={activity}
        side="front"
        selected={null}
        onSelect={onSelect}
        accentColor="#D99A50"
        height={300}
      />,
    );
    // The middle of the chest, then a thigh.
    tapAt(0.5, 0.22);
    expect(onSelect).toHaveBeenLastCalledWith('chest');
    tapAt(0.35, 0.55);
    expect(onSelect).toHaveBeenLastCalledWith('quadriceps');
    onSelect.mockClear();
    // The background beside the head.
    tapAt(0.05, 0.05);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('colours each trained group in its level, over the grey body -- and none untrained', () => {
    render(
      <MuscleActivityFigure
        activity={activity}
        side="front"
        selected={null}
        onSelect={jest.fn()}
        accentColor="#D99A50"
        height={300}
      />,
    );
    expect(screen.getByTestId('muscle-activity-figure-layer-chest').props.tintColor).toBe(
      '#D99A50',
    );
    expect(screen.queryByTestId('muscle-activity-figure-layer-quadriceps')).toBeNull();
  });

  it('makes a chosen group stand out -- the rest quieter, an untrained one in grey', () => {
    render(
      <MuscleActivityFigure
        activity={activity}
        side="front"
        selected="quadriceps"
        onSelect={jest.fn()}
        accentColor="#D99A50"
        height={300}
      />,
    );
    const opacity = (group: string) =>
      StyleSheet.flatten(screen.getByTestId(`muscle-activity-figure-layer-${group}`).props.style)
        .opacity;
    expect(opacity('quadriceps')).toBe(1);
    expect(opacity('chest')).toBe(0.3);
  });

  it("knows every group drawn on each figure, a man's and a woman's, from its tap map", () => {
    for (const sex of ['male', 'female'] as const) {
      for (const side of ['front', 'back'] as const) {
        const view = MUSCLE_HEATMAP[sex]![side];
        const found = new Set(
          [...view.tapRows.join('')].filter((code) => code !== '.').map((code) => TAP_CODES[code]),
        );
        expect([...found].sort()).toEqual(Object.keys(view.layers).sort());
      }
      expect(groupAt(MUSCLE_HEATMAP[sex]!.front, 0.5, 0.22)).toBe('chest');
      expect(groupAt(MUSCLE_HEATMAP[sex]!.back, 0.5, 0.47)).toBe('glutes');
    }
  });

  it("draws a woman's figure for a woman, and a man's otherwise", () => {
    const female = MUSCLE_HEATMAP.female!.front;
    const male = MUSCLE_HEATMAP.male!.front;
    expect(female.body).not.toEqual(male.body);
    const figure = (gender: string | null) => (
      <ProfileContext.Provider value={{ profile: { gender } } as never}>
        <MuscleActivityFigure
          activity={activity}
          side="front"
          selected={null}
          onSelect={jest.fn()}
          accentColor="#D99A50"
          height={300}
        />
      </ProfileContext.Provider>
    );
    const { rerender } = render(figure('female'));
    expect(
      screen.getByTestId('muscle-activity-figure-body', { includeHiddenElements: true }).props
        .source,
    ).toEqual(female.body);
    expect(screen.getByTestId('muscle-activity-figure-layer-chest').props.source).toEqual(
      female.layers.chest,
    );
    rerender(figure('male'));
    expect(
      screen.getByTestId('muscle-activity-figure-body', { includeHiddenElements: true }).props
        .source,
    ).toEqual(male.body);
    rerender(figure(null));
    expect(
      screen.getByTestId('muscle-activity-figure-body', { includeHiddenElements: true }).props
        .source,
    ).toEqual(male.body);
  });

  it('says what it shows to assistive tech', () => {
    render(
      <MuscleActivityFigure
        activity={activity}
        side="front"
        selected={null}
        onSelect={jest.fn()}
        accentColor="#D99A50"
        height={300}
      />,
    );
    expect(screen.getByLabelText(/Chest: Recently trained/)).toBeTruthy();
  });

  it('has more colour for more training, and none for no recent training', () => {
    const palette = levelColors('#D99A50');
    expect(palette.recent).toBe('#D99A50');
    expect(palette.frequent).not.toBe(palette.less);
    expect(palette.none).toBeNull();
  });
});
