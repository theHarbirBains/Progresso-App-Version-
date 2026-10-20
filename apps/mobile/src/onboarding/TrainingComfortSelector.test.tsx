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
    expect(screen.getByText(/not sure how to track progress/i)).toBeTruthy();
    expect(screen.getByText(/programming from a coach/i)).toBeTruthy();
  });

  it('reports the answer pressed', () => {
    const onChange = jest.fn();
    render(<TrainingComfortSelector testID="comfort" value={null} onChange={onChange} />);

    fireEvent.press(screen.getByTestId('comfort-knows_basics'));

    expect(onChange).toHaveBeenCalledWith('knows_basics');
  });
});
