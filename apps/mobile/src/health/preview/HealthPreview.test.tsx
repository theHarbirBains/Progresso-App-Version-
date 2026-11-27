import { fireEvent, render, screen } from '@testing-library/react-native';
import { CLIENT_PROGRESS_SECTIONS, ownProgressSections } from '../../progress/progressSections';
import { HealthPreviewScreen } from '../../screens/HealthPreviewScreen';
import { HealthOverview } from './HealthOverview';
import type { HealthPage } from './healthPreview';
import { insightsFor, metricsFor, sourceOf, type HealthScenario } from './sampleHealthData';

const ACCENT = '#D99A50';
const SCENARIOS: HealthScenario[] = ['apple', 'oura', 'both', 'none'];
const PAGES: HealthPage[] = [
  'recovery',
  'sleep',
  'activity',
  'heart',
  'training',
  'devices',
  'insights',
];

function renderPage(page: HealthPage, scenario: HealthScenario, metric?: 'hrv' | 'vo2max') {
  const navigation = { push: jest.fn(), goBack: jest.fn() };
  render(
    <HealthPreviewScreen
      navigation={navigation as never}
      route={{ key: 'k', name: 'HealthPreview', params: { page, scenario, metric } } as never}
    />,
  );
  return navigation;
}

describe('the Health prototype is never real, and never in a release', () => {
  it('shows the Health tab only in development builds, and never on a trainer’s view', () => {
    expect(ownProgressSections(true).map((s) => s.key)).toContain('Health');
    expect(ownProgressSections(false).map((s) => s.key)).not.toContain('Health');
    expect(CLIENT_PROGRESS_SECTIONS.map((s) => s.key)).not.toContain('Health');
  });

  it('says it is sample data, and calls readiness an example', () => {
    render(<HealthOverview accent={ACCENT} onOpen={jest.fn()} />);
    expect(screen.getByTestId('health-sample-note')).toHaveTextContent(/sample data/);
    expect(screen.getByTestId('health-readiness')).toHaveTextContent(/EXAMPLE/);
    renderPage('recovery', 'both');
    expect(screen.getByTestId('health-recovery-hero')).toHaveTextContent(
      /doesn’t calculate a score yet/,
    );
  });
});

describe('HealthOverview', () => {
  it('opens each page from its block, with the scenario chosen', () => {
    const onOpen = jest.fn();
    render(<HealthOverview accent={ACCENT} onOpen={onOpen} />);
    fireEvent.press(screen.getByTestId('health-readiness'));
    expect(onOpen).toHaveBeenLastCalledWith('recovery', 'both', undefined);
    fireEvent.press(screen.getByTestId('health-sleep'));
    expect(onOpen).toHaveBeenLastCalledWith('sleep', 'both', undefined);
    fireEvent.press(screen.getByTestId('health-heart-hrv'));
    expect(onOpen).toHaveBeenLastCalledWith('metric', 'both', 'hrv');
    fireEvent.press(screen.getByTestId('health-training'));
    expect(onOpen).toHaveBeenLastCalledWith('training', 'both', undefined);
    fireEvent.press(screen.getByTestId('health-devices'));
    expect(onOpen).toHaveBeenLastCalledWith('devices', 'both', undefined);
  });

  it('without a wearable: no readiness, no heart -- and Health still works', () => {
    render(<HealthOverview accent={ACCENT} onOpen={jest.fn()} />);
    fireEvent.press(screen.getByTestId('health-scenario-none'));
    expect(screen.queryByTestId('health-readiness')).toBeNull();
    expect(screen.queryByTestId('health-heart-hrv')).toBeNull();
    expect(screen.getByTestId('health-no-wearable')).toHaveTextContent(/works without a wearable/);
    expect(screen.getByTestId('health-activity')).toHaveTextContent(/workouts/);
  });

  it('moves between days, never past today', () => {
    render(<HealthOverview accent={ACCENT} onOpen={jest.fn()} />);
    expect(screen.getByTestId('health-day')).toHaveTextContent('Today');
    fireEvent.press(screen.getByTestId('health-day-back'));
    expect(screen.getByTestId('health-day')).toHaveTextContent('Yesterday');
    fireEvent.press(screen.getByTestId('health-day-forward'));
    fireEvent.press(screen.getByTestId('health-day-forward'));
    expect(screen.getByTestId('health-day')).toHaveTextContent('Today');
  });
});

describe('every page, in every device scenario', () => {
  for (const scenario of SCENARIOS) {
    for (const page of PAGES) {
      it(`${page} -- ${scenario}`, () => {
        renderPage(page, scenario);
        expect(screen.getByTestId('health-preview-header')).toBeTruthy();
      });
    }
  }

  it('shows a metric a device can’t give as not available -- never as 0', () => {
    renderPage('heart', 'oura');
    expect(screen.getByTestId('health-heart-vo2max')).toHaveTextContent(/Not available/);
    expect(screen.getByTestId('health-heart-vo2max')).not.toHaveTextContent(/\b0\b/);
    expect(metricsFor('oura')).not.toContain('vo2max');
    expect(metricsFor('none')).toEqual([]);
  });

  it('opens a metric’s own page with its periods, source and when it was updated', () => {
    renderPage('metric', 'apple', 'hrv');
    expect(screen.getByTestId('health-metric-hero')).toHaveTextContent(/62/);
    fireEvent.press(screen.getByTestId('health-metric-period-7'));
    fireEvent.press(screen.getByTestId('health-metric-period-90'));
    expect(screen.getByText('Apple Health')).toBeTruthy();
    expect(screen.getByText('Today, 6:41 AM')).toBeTruthy();
  });

  it('with both devices, gives each measurement one source', () => {
    renderPage('devices', 'both');
    expect(screen.getByTestId('health-devices-sources')).toHaveTextContent(/never both added up/);
    expect(sourceOf('sleep', 'both')).toBe('oura');
    expect(sourceOf('vo2max', 'both')).toBe('apple');
  });

  it('previews each connection state on a connected device', () => {
    renderPage('devices', 'apple');
    expect(screen.getByTestId('health-device-apple')).toHaveTextContent(/Connected/);
    expect(screen.getByTestId('health-device-oura')).toHaveTextContent(/Not connected/);
    fireEvent.press(screen.getByTestId('health-device-state-permission'));
    expect(screen.getByTestId('health-device-apple')).toHaveTextContent(/Permission needed/);
    fireEvent.press(screen.getByTestId('health-device-state-issue'));
    expect(screen.getByTestId('health-device-apple')).toHaveTextContent(/Try Again/);
  });

  it('only offers insights a scenario could support', () => {
    expect(insightsFor('none').map((i) => i.id)).toEqual(['volume-up']);
    expect(insightsFor('both').length).toBeGreaterThan(3);
  });
});
