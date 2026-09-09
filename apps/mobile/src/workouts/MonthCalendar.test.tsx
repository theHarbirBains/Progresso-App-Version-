import { fireEvent, render, screen } from '@testing-library/react-native';
import { MonthCalendar } from './MonthCalendar';

const baseProps = {
  testID: 'calendar',
  year: 2026,
  month: 9,
  completedDateKeys: new Set<string>(),
  selectedDateKey: null,
  todayKey: '2026-09-07',
  accentColor: '#2F80FF',
  onAccentColor: '#FFFFFF',
  onSelectDate: jest.fn(),
  onPrevMonth: jest.fn(),
  onNextMonth: jest.fn(),
};

describe('MonthCalendar', () => {
  it('renders the month/year label and every day of the month', () => {
    render(<MonthCalendar {...baseProps} />);

    expect(screen.getByText('September 2026')).toBeTruthy();
    expect(screen.getByTestId('calendar-day-2026-09-01')).toBeTruthy();
    expect(screen.getByTestId('calendar-day-2026-09-30')).toBeTruthy();
  });

  it('includes leading days from the previous month', () => {
    render(<MonthCalendar {...baseProps} />);

    expect(screen.getByTestId('calendar-day-2026-08-31')).toBeTruthy();
  });

  it('calls onPrevMonth/onNextMonth when the nav arrows are pressed', () => {
    const onPrevMonth = jest.fn();
    const onNextMonth = jest.fn();
    render(<MonthCalendar {...baseProps} onPrevMonth={onPrevMonth} onNextMonth={onNextMonth} />);

    fireEvent.press(screen.getByTestId('calendar-prev-month'));
    fireEvent.press(screen.getByTestId('calendar-next-month'));

    expect(onPrevMonth).toHaveBeenCalled();
    expect(onNextMonth).toHaveBeenCalled();
  });

  it("calls onSelectDate with the pressed day's date key", () => {
    const onSelectDate = jest.fn();
    render(<MonthCalendar {...baseProps} onSelectDate={onSelectDate} />);

    fireEvent.press(screen.getByTestId('calendar-day-2026-09-15'));

    expect(onSelectDate).toHaveBeenCalledWith('2026-09-15');
  });

  it('marks the selected day via accessibilityState', () => {
    render(<MonthCalendar {...baseProps} selectedDateKey="2026-09-15" />);

    expect(screen.getByTestId('calendar-day-2026-09-15').props.accessibilityState.selected).toBe(
      true,
    );
    expect(screen.getByTestId('calendar-day-2026-09-16').props.accessibilityState.selected).toBe(
      false,
    );
  });

  it("marks today's cell distinctly from a day with no workout", () => {
    render(<MonthCalendar {...baseProps} />);

    // Today's day number renders in onAccentColor (white here) against the accent-filled circle.
    const todayText = screen.getByText('7');
    expect(todayText.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ color: '#FFFFFF' })]),
    );
  });

  it('uses the dynamic accent color for a completed date, not a hardcoded color', () => {
    render(
      <MonthCalendar
        {...baseProps}
        completedDateKeys={new Set(['2026-09-05'])}
        accentColor="#8B5CF6"
      />,
    );

    const dot = screen.getByTestId('calendar-dot-2026-09-05');
    expect(dot.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ backgroundColor: '#8B5CF6' })]),
    );
  });
});
