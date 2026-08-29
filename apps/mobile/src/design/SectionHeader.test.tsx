import { render, screen } from '@testing-library/react-native';
import { SectionHeader } from './SectionHeader';

describe('SectionHeader', () => {
  it('renders its label', () => {
    render(<SectionHeader testID="heading" label="Recent Workout" />);

    expect(screen.getByTestId('heading')).toHaveTextContent('Recent Workout');
  });
});
