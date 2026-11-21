import { fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import type { CardioValues } from './cardioActivities';
import { CardioSheet } from './CardioSheet';

function renderSheet(entry: CardioValues | null = null, onRemove?: () => void) {
  const onSave = jest.fn();
  const onClose = jest.fn();
  render(
    <CardioSheet
      visible
      entry={entry}
      accentColor="#E8A23C"
      onAccentColor="#000"
      onSave={onSave}
      onRemove={onRemove}
      onClose={onClose}
    />,
  );
  return { onSave, onClose };
}

const type = (field: string, text: string) =>
  fireEvent.changeText(screen.getByTestId(`cardio-sheet-${field}`), text);

describe('CardioSheet', () => {
  it('offers every activity as a tile first, the ones done last leading', () => {
    render(
      <CardioSheet
        visible
        entry={null}
        recent={['swimming']}
        accentColor="#E8A23C"
        onAccentColor="#000"
        onSave={jest.fn()}
        onClose={jest.fn()}
      />,
    );
    const labels = within(screen.getByTestId('cardio-sheet-activities'))
      .getAllByRole('button')
      .map((b) => b.props.accessibilityLabel);
    expect(labels.slice(0, 9)).toEqual([
      'Swimming',
      'Treadmill',
      'Outdoor Running',
      'Walking',
      'Cycling',
      'StairMaster',
      'Elliptical',
      'Rowing',
      'Other',
    ]);
  });

  it('logs a StairMaster with its floors, its level nudged up from nothing', async () => {
    const { onSave, onClose } = renderSheet();
    fireEvent.press(screen.getByTestId('cardio-sheet-activity-stairmaster'));
    // Nothing a StairMaster doesn't have.
    expect(screen.queryByTestId('cardio-sheet-distance')).toBeNull();
    type('duration', '20');
    type('floors', '60');
    fireEvent.press(screen.getByTestId('cardio-sheet-level-up'));
    fireEvent.press(screen.getByTestId('cardio-sheet-level-up'));
    fireEvent.press(screen.getByTestId('cardio-sheet-save'));
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          activity: 'stairmaster',
          durationSeconds: 1200,
          floors: 60,
          resistanceLevel: 2,
          steps: null,
        }),
      ),
    );
    expect(onClose).toHaveBeenCalled();
  });

  it("logs a swim's laps, its distance worked out from them and said as it's typed", async () => {
    const { onSave } = renderSheet();
    fireEvent.press(screen.getByTestId('cardio-sheet-activity-swimming'));
    type('duration', '30');
    type('poolLength', '25');
    type('laps', '60');
    expect(screen.getByTestId('cardio-sheet-readout')).toHaveTextContent(
      '1.5 km from your laps · Pace 2:00 /100 m · 3 km/h',
    );
    fireEvent.press(screen.getByTestId('cardio-sheet-save'));
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({ distanceM: 1500, laps: 60, poolLengthM: 25 }),
      ),
    );
  });

  it('goes back from the tiles to what was typed, once an activity is picked', () => {
    const { onClose } = renderSheet();
    expect(screen.getByTestId('cardio-sheet-cancel')).toHaveTextContent('Cancel');
    fireEvent.press(screen.getByTestId('cardio-sheet-activity-cycling'));
    type('duration', '45');
    fireEvent.press(screen.getByTestId('cardio-sheet-change'));
    fireEvent.press(screen.getByTestId('cardio-sheet-cancel'));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByTestId('cardio-sheet-activity')).toHaveTextContent('Cycling');
    expect(screen.getByTestId('cardio-sheet-duration')).toHaveProp('value', '45');
  });

  it('says what to fix on the field, and saves nothing', async () => {
    const { onSave } = renderSheet();
    fireEvent.press(screen.getByTestId('cardio-sheet-activity-rowing'));
    type('duration', '8');
    type('strokeRate', '250');
    fireEvent.press(screen.getByTestId('cardio-sheet-save'));
    expect(await screen.findByTestId('cardio-sheet-strokeRate-error')).toHaveTextContent(
      /strokes a minute/,
    );
    expect(onSave).not.toHaveBeenCalled();
  });

  it('names an Other activity and keeps a note with it', async () => {
    const { onSave } = renderSheet();
    fireEvent.press(screen.getByTestId('cardio-sheet-activity-other'));
    type('name', 'Jump Rope');
    type('duration', '10');
    type('notes', 'Double unders');
    fireEvent.press(screen.getByTestId('cardio-sheet-save'));
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({ activity: 'other', name: 'Jump Rope', notes: 'Double unders' }),
      ),
    );
  });

  it('opens a saved activity on its figures, to change or remove', async () => {
    const onRemove = jest.fn();
    const walk: CardioValues = {
      activity: 'walking',
      name: null,
      durationSeconds: 2700,
      distanceM: 4000,
      speedKmh: null,
      speedSetting: null,
      inclinePercent: null,
      resistanceLevel: null,
      floors: null,
      steps: null,
      strokeRate: null,
      poolLengthM: null,
      laps: null,
      notes: null,
    };
    const { onClose } = renderSheet(walk, onRemove);
    expect(screen.getByTestId('cardio-sheet-activity')).toHaveTextContent('Walking');
    expect(screen.getByTestId('cardio-sheet-duration')).toHaveProp('value', '45');
    expect(screen.getByTestId('cardio-sheet-distance')).toHaveProp('value', '4');
    fireEvent.press(screen.getByTestId('cardio-sheet-remove'));
    await waitFor(() => expect(onRemove).toHaveBeenCalled());
    expect(onClose).toHaveBeenCalled();
  });
});
