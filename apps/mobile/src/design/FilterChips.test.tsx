import { fireEvent, render, screen } from '@testing-library/react-native';
import { FilterChips } from './FilterChips';

describe('FilterChips', () => {
  it('marks the chosen chip and changes it on a tap', () => {
    const onChange = jest.fn();
    render(
      <FilterChips
        testID="chips"
        options={[
          { value: 'all', label: 'All' },
          { value: 'new', label: 'New · 3' },
        ]}
        value="all"
        onChange={onChange}
      />,
    );

    expect(screen.getByTestId('chips-all').props.accessibilityState.selected).toBe(true);
    expect(screen.getByTestId('chips-new').props.accessibilityState.selected).toBe(false);
    fireEvent.press(screen.getByTestId('chips-new'));
    expect(onChange).toHaveBeenCalledWith('new');
  });
});
