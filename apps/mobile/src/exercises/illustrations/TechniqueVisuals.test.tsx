import { render, screen } from '@testing-library/react-native';
import { Image } from 'expo-image';
import { ExerciseThumbnail } from './ExerciseIllustration';
import { TechniqueVisual } from './TechniqueVisuals';

// An exercise without renders keeps its drawings: here no exercise has been rendered.
jest.mock('./renders.generated', () => ({
  EXERCISE_RENDERS: {},
  RENDER_ANCHORS: ['hands', 'feet', 'hip', 'knee', 'ankle', 'hips', 'torso', 'shoulders', 'head'],
}));

describe('without renders', () => {
  it("draws Technique & Setup's close look from the drawing", () => {
    render(
      <TechniqueVisual
        slug="db-bench-press"
        visual={{ kind: 'closeup', focus: 'hands', frame: 1, mark: 'line' }}
        accent="#D99A50"
        size={112}
        testID="visual"
      />,
    );
    expect(screen.getByTestId('visual')).toBeTruthy();
    expect(screen.queryByTestId('technique-closeup-render')).toBeNull();
    expect(screen.UNSAFE_queryAllByType(Image)).toHaveLength(0);
  });

  it('draws the list thumbnail', () => {
    render(<ExerciseThumbnail slug="db-bench-press" size={44} testID="thumb" />);
    expect(screen.getByTestId('thumb')).toBeTruthy();
    expect(screen.UNSAFE_queryAllByType(Image)).toHaveLength(0);
  });
});
