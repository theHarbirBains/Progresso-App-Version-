import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from './Text';
import { SwipeToDelete } from './SwipeToDelete';

function renderRow(open: boolean) {
  const onOpenChange = jest.fn();
  const onDelete = jest.fn();
  render(
    <SwipeToDelete
      testID="row"
      name="Chicken Breast"
      open={open}
      onOpenChange={onOpenChange}
      onDelete={onDelete}
    >
      <Text>Chicken Breast</Text>
    </SwipeToDelete>,
  );
  return { onOpenChange, onDelete };
}

describe('SwipeToDelete', () => {
  it('keeps Delete out of reach while shut', () => {
    const { onDelete } = renderRow(false);

    fireEvent.press(screen.getByTestId('row-delete'));

    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.queryByTestId('row-close')).toBeNull();
  });

  it('deletes from its Delete when open, named for what it deletes', () => {
    const { onDelete } = renderRow(true);

    const action = screen.getByLabelText('Delete Chicken Breast');
    fireEvent.press(action);

    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('closes on a tap on the row while open', () => {
    const { onOpenChange, onDelete } = renderRow(true);

    fireEvent.press(screen.getByTestId('row-close'));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onDelete).not.toHaveBeenCalled();
  });
});
