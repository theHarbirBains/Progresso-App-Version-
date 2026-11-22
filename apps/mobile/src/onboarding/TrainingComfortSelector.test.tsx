import { fireEvent, render, screen } from '@testing-library/react-native';
import { TrainingComfortSelector } from './TrainingComfortSelector';

describe('TrainingComfortSelector', () => {
  it('shows all four answers with their descriptions', () => {
    render(<TrainingComfortSelector testID="comfort" value={null} onChange={jest.fn()} />);

    for (const value of [
      'still_learning',
      'knows_basics',
      'plans_and_progresses',
      'follows_method',
    ]) {
      expect(screen.getByTestId(`comfort-${value}`)).toBeTruthy();
    }
    expect(screen.getByText("I'm a beginner")).toBeTruthy();
    expect(screen.getByText(/learning how to choose exercises, structure workouts/)).toBeTruthy();
    expect(screen.getByText('I understand the basics')).toBeTruthy();
    expect(screen.getByText("I'm confident with my training")).toBeTruthy();
    expect(screen.getByText('I follow structured programming')).toBeTruthy();
    expect(screen.getByText(/periodization or a coach-designed program/)).toBeTruthy();
  });

  it('reports the answer pressed', () => {
    const onChange = jest.fn();
    render(<TrainingComfortSelector testID="comfort" value={null} onChange={onChange} />);

    fireEvent.press(screen.getByTestId('comfort-knows_basics'));

    expect(onChange).toHaveBeenCalledWith('knows_basics');
  });
});
