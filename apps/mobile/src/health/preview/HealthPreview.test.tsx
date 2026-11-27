import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import {
  getRequestStatusForAuthorization,
  isHealthDataAvailable,
  queryStatisticsCollectionForQuantity,
} from '@kingstinct/react-native-healthkit';
import { Platform } from 'react-native';
import { CLIENT_PROGRESS_SECTIONS, ownProgressSections } from '../../progress/progressSections';
import { HealthPreviewScreen } from '../../screens/HealthPreviewScreen';
import { heartHighlights, HealthOverview, setupNames } from './HealthOverview';
import { moreWithDevices, sectionsFor } from './HealthPages';
import { setPreviewSetup, type HealthPage } from './healthPreview';
import {
  insightsFor,
  metricsFor,
  NO_DEVICES,
  sourceOf,
  type DeviceSetup,
  type MetricKey,
} from './sampleHealthData';

// Devices' real Apple Health card reads the person's own connection; none here.
jest.mock('../../lib/supabase', () => ({ supabase: {} }));

const ACCENT = '#D99A50';

const setups: Record<string, DeviceSetup> = {
  nothing: NO_DEVICES,
  phone: { ...NO_DEVICES, iphone: true },
  watch: { ...NO_DEVICES, iphone: true, appleWatch: true },
  oura: { ...NO_DEVICES, oura: true },
  watchAndOura: { ...NO_DEVICES, iphone: true, appleWatch: true, oura: true },
  otherWatch: { ...NO_DEVICES, iphone: true, otherWatch: true },
};

function use(setup: DeviceSetup) {
  act(() => setPreviewSetup(setup));
}

function renderPage(page: HealthPage, metric?: MetricKey, onboarding?: boolean) {
  const navigation = { push: jest.fn(), goBack: jest.fn() };
  render(
    <HealthPreviewScreen
      navigation={navigation as never}
      route={{ key: 'k', name: 'HealthPreview', params: { page, metric, onboarding } } as never}
    />,
  );
  return navigation;
}

afterEach(() => use(setups.watch));

describe('the Health prototype is never real, and never in a release', () => {
  it('shows Health (the steps) on iPhone, off it only in development builds, never on a trainer’s view', () => {
    expect(ownProgressSections(false).map((s) => s.key)).toContain('Health');
    const os = Platform.OS;
    Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });
    try {
      expect(ownProgressSections(false).map((s) => s.key)).not.toContain('Health');
      expect(ownProgressSections(true).map((s) => s.key)).toContain('Health');
    } finally {
      Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
    }
    expect(CLIENT_PROGRESS_SECTIONS.map((s) => s.key)).not.toContain('Health');
  });

  it('says it is sample data, and never makes a readiness score of its own', () => {
    use(setups.watch);
    render(<HealthOverview accent={ACCENT} onOpen={jest.fn()} />);
    expect(screen.getByTestId('health-sample-note')).toHaveTextContent(
      /sample data, except your steps/,
    );
    // A watch alone: the signals, no score.
    expect(screen.queryByTestId('health-readiness')).toBeNull();
    expect(screen.getByTestId('health-recovery-signals')).toBeTruthy();
  });
});

describe('Health, made for each person’s devices', () => {
  it('with nothing connected: their training, and Set Up Health -- no sleep, heart or recovery', () => {
    use(setups.nothing);
    const onOpen = jest.fn();
    render(<HealthOverview accent={ACCENT} onOpen={onOpen} />);
    expect(screen.getByTestId('health-set-up')).toHaveTextContent(/Bring in your health data/);
    expect(screen.getByTestId('health-training')).toBeTruthy();
    for (const id of [
      'health-sleep',
      'health-activity',
      'health-recovery-signals',
      'health-heart-hrv',
    ]) {
      expect(screen.queryByTestId(id)).toBeNull();
    }
    fireEvent.press(screen.getByTestId('health-set-up-button'));
    expect(onOpen).toHaveBeenLastCalledWith('setup', undefined);
  });

  it('with just an iPhone: steps, and a watch or ring offered -- no sleep or heart', () => {
    use(setups.phone);
    render(<HealthOverview accent={ACCENT} onOpen={jest.fn()} />);
    expect(screen.getByTestId('health-activity')).toBeTruthy();
    expect(screen.queryByTestId('health-sleep')).toBeNull();
    expect(screen.queryByTestId('health-heart-restingHr')).toBeNull();
    expect(screen.getByTestId('health-add-wearable')).toBeTruthy();
  });

  it('with an Oura Ring: Oura’s own readiness, and its temperature among the heart’s figures', () => {
    use(setups.oura);
    render(<HealthOverview accent={ACCENT} onOpen={jest.fn()} />);
    expect(screen.getByTestId('health-readiness')).toHaveTextContent(/OURA/);
    expect(heartHighlights(setups.oura)).toEqual(['restingHr', 'hrv', 'temperature']);
    expect(heartHighlights(setups.watch)).toEqual(['restingHr', 'hrv', 'vo2max']);
  });

  it('each device brings its own data, and with two, each measurement has one source', () => {
    expect(metricsFor(setups.phone)).toEqual(['steps']);
    expect(metricsFor(setups.oura)).toContain('temperature');
    expect(metricsFor(setups.oura)).not.toContain('vo2max');
    expect(metricsFor(setups.watch)).toContain('vo2max');
    expect(sourceOf('sleep', setups.watchAndOura)).toBe('oura');
    expect(sourceOf('steps', setups.watchAndOura)).toBe('appleWatch');
    expect(sourceOf('steps', setups.phone)).toBe('iphone');
    expect(setupNames(setups.watchAndOura)).toBe('iPhone, Apple Watch and Oura Ring');
  });

  it('the preview’s device chips change what Health shows', () => {
    use(setups.phone);
    render(<HealthOverview accent={ACCENT} onOpen={jest.fn()} />);
    expect(screen.queryByTestId('health-sleep')).toBeNull();
    fireEvent.press(screen.getByTestId('health-preview-device-oura'));
    expect(screen.getByTestId('health-sleep')).toBeTruthy();
  });
});

describe('steps are real -- Apple Health’s, never sample', () => {
  const day = (daysAgo: number, quantity: number) => {
    const now = new Date();
    return {
      startDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysAgo),
      sumQuantity: { unit: 'count', quantity },
    };
  };

  afterEach(() => {
    jest.mocked(isHealthDataAvailable).mockReturnValue(false);
    jest.mocked(getRequestStatusForAuthorization).mockResolvedValue(1);
    jest.mocked(queryStatisticsCollectionForQuantity).mockResolvedValue([] as never);
  });

  it('shows today’s count from Apple Health on the Activity tile', async () => {
    jest.mocked(isHealthDataAvailable).mockReturnValue(true);
    jest.mocked(getRequestStatusForAuthorization).mockResolvedValue(2);
    jest
      .mocked(queryStatisticsCollectionForQuantity)
      .mockResolvedValue([day(1, 9000), day(0, 5321)] as never);
    use(setups.phone);
    render(<HealthOverview accent={ACCENT} onOpen={jest.fn()} />);

    await waitFor(() =>
      expect(screen.getByTestId('health-activity-steps')).toHaveTextContent('5,321 steps'),
    );
    expect(screen.getByTestId('health-activity-source')).toHaveTextContent('From Apple Health');
  });

  it('shows no count -- never a 0 -- until Apple Health is connected, and says so', async () => {
    jest.mocked(isHealthDataAvailable).mockReturnValue(true);
    render(<HealthOverview accent={ACCENT} onOpen={jest.fn()} />);

    await waitFor(() =>
      expect(screen.getByTestId('health-activity-source')).toHaveTextContent(
        'Connect Apple Health',
      ),
    );
    expect(screen.getByTestId('health-activity-steps')).toHaveTextContent('— steps');
  });

  it('says where Apple Health isn’t available', async () => {
    render(<HealthOverview accent={ACCENT} onOpen={jest.fn()} />);
    await waitFor(() =>
      expect(screen.getByTestId('health-activity-source')).toHaveTextContent(
        'Apple Health isn’t available here',
      ),
    );
  });

  it('opens Activity on the real steps -- the same as a release build’s Health tab -- then the sample extras', async () => {
    jest.mocked(isHealthDataAvailable).mockReturnValue(true);
    jest.mocked(getRequestStatusForAuthorization).mockResolvedValue(2);
    jest.mocked(queryStatisticsCollectionForQuantity).mockResolvedValue([day(0, 5321)] as never);
    use(setups.watch);
    renderPage('activity');

    expect(await screen.findByTestId('progress-steps-today')).toHaveTextContent(/5,321/);
    expect(screen.getByTestId('health-activity-today')).toHaveTextContent(/sample data/);
  });
});

describe('the pages', () => {
  const pages: HealthPage[] = [
    'recovery',
    'sleep',
    'activity',
    'heart',
    'training',
    'devices',
    'insights',
    'setup',
  ];
  for (const [name, setup] of Object.entries(setups)) {
    for (const page of pages) {
      it(`${page} -- ${name}`, () => {
        use(setup);
        renderPage(page);
        expect(screen.getByTestId('health-preview-header')).toBeTruthy();
      });
    }
  }

  it('lists only the heart figures their devices give, and what others would add', () => {
    use(setups.oura);
    renderPage('heart');
    expect(screen.getByTestId('health-heart-temperature')).toBeTruthy();
    expect(screen.queryByTestId('health-heart-vo2max')).toBeNull();
    expect(screen.getByTestId('health-heart-more')).toHaveTextContent(/VO₂ Max.*Apple Watch/);
    expect(moreWithDevices(setups.watchAndOura)).toEqual([]);
  });

  it('leaves training-only rows on Training & Recovery without a wearable', () => {
    use(setups.phone);
    renderPage('training');
    expect(screen.getByTestId('health-training-Volume')).toBeTruthy();
    expect(screen.queryByTestId('health-training-Sleep')).toBeNull();
  });

  it('opens a metric’s own page with its periods, source and when it was updated', () => {
    use(setups.watch);
    renderPage('metric', 'hrv');
    expect(screen.getByTestId('health-metric-hero')).toHaveTextContent(/62/);
    fireEvent.press(screen.getByTestId('health-metric-period-7'));
    fireEvent.press(screen.getByTestId('health-metric-period-90'));
    expect(screen.getByText('Apple Watch')).toBeTruthy();
    expect(screen.getByText('Today, 6:41 AM')).toBeTruthy();
  });

  it('Devices: theirs with a state to preview, and the others to add any time', () => {
    use(setups.watch);
    renderPage('devices');
    expect(screen.getByTestId('health-device-appleWatch')).toHaveTextContent(/Connected/);
    expect(screen.getByTestId('health-add-oura')).toBeTruthy();
    fireEvent.press(screen.getByTestId('health-device-state-permission'));
    expect(screen.getByTestId('health-device-appleWatch')).toHaveTextContent(/Permission needed/);
  });
});

describe('Set Up Health, and onboarding’s step', () => {
  it('asks what they use, shows what each brings, and tailors Health to it', () => {
    use(setups.nothing);
    const navigation = renderPage('setup', undefined, true);
    expect(screen.getByTestId('health-setup-onboarding')).toBeTruthy();
    expect(screen.getByText('Do you use a fitness tracker?')).toBeTruthy();

    fireEvent.press(screen.getByTestId('health-setup-oura'));
    fireEvent.press(screen.getByTestId('health-setup-continue'));
    expect(screen.getByTestId('health-setup-connect-oura')).toHaveTextContent(/Readiness score/);
    fireEvent.press(screen.getByTestId('health-setup-connect-oura-button'));
    expect(screen.getByTestId('health-setup-connect-oura')).toHaveTextContent(/Connected/);
    fireEvent.press(screen.getByTestId('health-setup-next'));
    expect(screen.getByTestId('health-setup-summary')).toHaveTextContent(/Readiness \(Oura\)/);
    fireEvent.press(screen.getByTestId('health-setup-done'));
    expect(navigation.goBack).toHaveBeenCalled();

    render(<HealthOverview accent={ACCENT} onOpen={jest.fn()} />);
    expect(screen.getByTestId('health-readiness')).toBeTruthy();
  });

  it('lets someone with no tracker go straight on -- Health still has their training', () => {
    expect(sectionsFor(NO_DEVICES)).toEqual([
      { name: 'Training', on: true },
      { name: 'Activity', on: false },
      { name: 'Recovery signals', on: false },
      { name: 'Sleep', on: false },
      { name: 'Heart', on: false },
    ]);
    expect(insightsFor(NO_DEVICES).map((insight) => insight.id)).toEqual(['volume-up']);
  });
});
