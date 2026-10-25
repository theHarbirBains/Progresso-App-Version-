import { fireEvent, render, screen } from '@testing-library/react-native';
import { fakeTouch } from '../testUtils/fakeTouch';
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

  it('claims a sideways drag early and holds on to it, telling the list to stay still meanwhile', () => {
    const onSwipingChange = jest.fn();
    render(
      <SwipeToDelete
        testID="row"
        name="Chicken Breast"
        open={false}
        onOpenChange={jest.fn()}
        onDelete={jest.fn()}
        onSwipingChange={onSwipingChange}
      >
        <Text>Chicken Breast</Text>
      </SwipeToDelete>,
    );
    const row = screen.getByTestId('row').children[1] as unknown as {
      props: Record<string, (event: unknown) => boolean>;
    };

    expect(row.props.onMoveShouldSetResponderCapture(fakeTouch(-8, 1, 16))).toBe(true);
    row.props.onResponderGrant(fakeTouch(-8, 1, 16));
    expect(onSwipingChange).toHaveBeenLastCalledWith(true);
    expect(row.props.onResponderTerminationRequest(fakeTouch(-8, 1, 20))).toBe(false);
    row.props.onResponderRelease(fakeTouch(-8, 1, 40));
    expect(onSwipingChange).toHaveBeenLastCalledWith(false);
  });
});
