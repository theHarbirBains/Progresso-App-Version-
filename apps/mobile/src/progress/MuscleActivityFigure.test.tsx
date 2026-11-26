import { render, screen } from '@testing-library/react-native';
import { REGION_GROUP, type MuscleRegion } from '../exercises/illustrations/muscles';
import { levelColors, MuscleActivityFigure } from './MuscleActivityFigure';
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

/** A drawn node as the test renderer has it: its props. */
type Node = { props: Record<string, unknown> };

/** Every drawn shape that answers a tap, with the muscle it is. */
function tappableMuscles(): { region: MuscleRegion; press: () => void }[] {
  return screen.UNSAFE_root.findAll(
    (node: Node) => typeof node.props.onPress === 'function' && typeof node.props.d === 'string',
  ).map((node: Node) => ({
    region: node.props.region as MuscleRegion,
    press: node.props.onPress as () => void,
  }));
}

describe('MuscleActivityFigure', () => {
  it('chooses a muscle’s group when a muscle on the figure is tapped', () => {
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
    const muscles = tappableMuscles();
    expect(muscles.length).toBeGreaterThan(0);
    muscles[0]!.press();
    expect(onSelect).toHaveBeenCalledTimes(1);
    const group = onSelect.mock.calls[0][0];
    expect(Object.values(REGION_GROUP)).toContain(group);
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
