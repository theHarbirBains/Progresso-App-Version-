import { render, screen } from '@testing-library/react-native';
import { MuscleVisualization, muscleGroupsToSlugs } from './MuscleVisualization';

describe('muscleGroupsToSlugs', () => {
  it('maps a simple one-to-one muscle group', () => {
    expect(muscleGroupsToSlugs(['chest'])).toEqual(['chest']);
    expect(muscleGroupsToSlugs(['shoulders'])).toEqual(['deltoids']);
    expect(muscleGroupsToSlugs(['biceps'])).toEqual(['biceps']);
    expect(muscleGroupsToSlugs(['triceps'])).toEqual(['triceps']);
    expect(muscleGroupsToSlugs(['forearms'])).toEqual(['forearm']);
  });

  it('maps the general "Back" category to every back-region slug at once', () => {
    expect(muscleGroupsToSlugs(['back'])).toEqual(['upper-back', 'lower-back', 'trapezius']);
  });

  it('maps the general "Abs" category to both abs and obliques', () => {
    expect(muscleGroupsToSlugs(['abs'])).toEqual(['abs', 'obliques']);
  });

  it('maps each leg category to its own distinct slug', () => {
    expect(muscleGroupsToSlugs(['quads'])).toEqual(['quadriceps']);
    expect(muscleGroupsToSlugs(['hamstrings'])).toEqual(['hamstring']);
    expect(muscleGroupsToSlugs(['glutes'])).toEqual(['gluteal']);
    expect(muscleGroupsToSlugs(['calves'])).toEqual(['calves']);
  });

  it('deduplicates overlapping slugs across multiple muscle groups', () => {
    expect(muscleGroupsToSlugs(['chest', 'chest'])).toEqual(['chest']);
  });

  it('returns an empty array for no muscle groups', () => {
    expect(muscleGroupsToSlugs([])).toEqual([]);
  });
});

describe('MuscleVisualization', () => {
  it('renders without crashing for the front side', () => {
    render(
      <MuscleVisualization
        muscleGroups={['chest', 'shoulders', 'triceps']}
        accentColor="#2F80FF"
        side="front"
        testID="muscle-viz"
      />,
    );

    expect(screen.getByTestId('muscle-viz')).toBeTruthy();
  });

  it('renders without crashing for the back side', () => {
    render(
      <MuscleVisualization
        muscleGroups={['back', 'biceps']}
        accentColor="#2F80FF"
        side="back"
        testID="muscle-viz"
      />,
    );

    expect(screen.getByTestId('muscle-viz')).toBeTruthy();
  });

  it('renders without crashing for no muscle groups', () => {
    render(
      <MuscleVisualization
        muscleGroups={[]}
        accentColor="#2F80FF"
        side="front"
        testID="muscle-viz"
      />,
    );

    expect(screen.getByTestId('muscle-viz')).toBeTruthy();
  });
});
