import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { expectNoBareText } from '../../testUtils/expectNoBareText';
import { HealthOverview } from '../preview/HealthOverview';
import { setPreviewSetup } from '../preview/healthPreview';
import { NO_DEVICES } from '../preview/sampleHealthData';
import { IPhoneHealth } from './IPhoneHealth';

// The overview reads today's steps from Apple Health for its tile; nothing here.
jest.mock('../../lib/supabase', () => ({ supabase: {} }));

const ACCENT = '#D99A50';

const WIDGETS = [
  'steps',
  'distance',
  'flights',
  'walkingSpeed',
  'steadiness',
  'asymmetry',
  'doubleSupport',
];

function renderPage() {
  render(<IPhoneHealth accent={ACCENT} />);
}

describe('iPhone-only Health (prototype)', () => {
  it('shows every iPhone metric in its own widget, in Activity and Mobility', () => {
    renderPage();
    expect(screen.getByText('Activity')).toBeTruthy();
    expect(screen.getByText('Mobility')).toBeTruthy();
    for (const widget of WIDGETS) {
      expect(screen.getByTestId(`iphone-health-${widget}`)).toBeTruthy();
    }
    expect(screen.getByTestId('iphone-health-steps-value')).toHaveTextContent('8,412');
    expect(screen.getByTestId('iphone-health-distance-value')).toHaveTextContent('6.1 km');
    expect(screen.getByTestId('iphone-health-flights-value')).toHaveTextContent('12 flights');
    expect(screen.getByTestId('iphone-health-walkingSpeed-value')).toHaveTextContent('4.8 km/h');
    expect(screen.getByTestId('iphone-health-steadiness-value')).toHaveTextContent('OK');
    expect(screen.getByTestId('iphone-health-asymmetry-value')).toHaveTextContent('2.1%');
    expect(screen.getByTestId('iphone-health-doubleSupport-value')).toHaveTextContent('27.4%');
    expectNoBareText();
  });

  it('switches between today, the last 7 days and the last 30', () => {
    renderPage();
    expect(screen.getByTestId('iphone-health-period-caption')).toHaveTextContent('Today');
    expect(screen.getByTestId('iphone-health-steps-ring')).toBeTruthy();

    fireEvent.press(screen.getByTestId('iphone-health-period-week'));
    expect(screen.getByTestId('iphone-health-period-caption')).toHaveTextContent(
      'Last 7 days · daily average',
    );
    expect(screen.getByTestId('iphone-health-steps-value')).toHaveTextContent('8,432');
    expect(screen.getByTestId('iphone-health-steps')).toHaveTextContent(/59,022 in all/);

    fireEvent.press(screen.getByTestId('iphone-health-period-month'));
    expect(screen.getByTestId('iphone-health-period-caption')).toHaveTextContent(
      'Last 30 days · daily average',
    );
    expect(screen.getByTestId('iphone-health-steps-change')).toHaveTextContent(
      /2% on the 30 days before/,
    );
    expectNoBareText();
  });

  it('says why a metric isn’t there -- never a 0', () => {
    renderPage();
    fireEvent.press(screen.getByTestId('iphone-health-preview-someMissing'));
    expect(screen.getByTestId('iphone-health-steadiness-missing')).toHaveTextContent(
      /Needs a few days of walking/,
    );
    expect(screen.getByTestId('iphone-health-asymmetry-missing')).toHaveTextContent(
      /—.*Not measured yet today/,
    );
    expect(screen.getByTestId('iphone-health-doubleSupport-missing')).toHaveTextContent(/^—/);
    expect(screen.queryByTestId('iphone-health-asymmetry-value')).toBeNull();
    // Over the week, it was measured.
    fireEvent.press(screen.getByTestId('iphone-health-period-week'));
    expect(screen.getByTestId('iphone-health-asymmetry-value')).toHaveTextContent('2.1%');
    expectNoBareText();
  });

  it('with nothing yet, one card -- not a page of empty widgets', () => {
    renderPage();
    fireEvent.press(screen.getByTestId('iphone-health-preview-nothing'));
    expect(screen.getByTestId('iphone-health-nothing')).toHaveTextContent(
      /Your iPhone already counts your steps/,
    );
    expect(screen.queryByTestId('iphone-health-steps')).toBeNull();
    fireEvent.press(screen.getByTestId('iphone-health-connect'));
    expect(screen.getByTestId('iphone-health-steps')).toBeTruthy();
  });

  it('shows nothing an iPhone alone can’t measure: no sleep, no heart', () => {
    renderPage();
    for (const period of ['day', 'week', 'month']) {
      fireEvent.press(screen.getByTestId(`iphone-health-period-${period}`));
      expect(screen.getByTestId('iphone-health')).not.toHaveTextContent(
        /sleep|heart rate|HRV|oxygen|readiness/i,
      );
    }
  });

  it('is what Health shows when the preview is just an iPhone, and only then', () => {
    act(() => setPreviewSetup({ ...NO_DEVICES, iphone: true }));
    render(<HealthOverview accent={ACCENT} onOpen={jest.fn()} />);
    expect(screen.getByTestId('iphone-health')).toBeTruthy();
    // Adding a watch brings the wearable overview back.
    fireEvent.press(screen.getByTestId('health-preview-device-appleWatch'));
    expect(screen.queryByTestId('iphone-health')).toBeNull();
    act(() => setPreviewSetup({ ...NO_DEVICES, iphone: true, appleWatch: true }));
  });
});
