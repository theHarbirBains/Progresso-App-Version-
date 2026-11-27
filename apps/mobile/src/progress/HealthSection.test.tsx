import { render, screen, waitFor } from '@testing-library/react-native';
import {
  getRequestStatusForAuthorization,
  isHealthDataAvailable,
  queryStatisticsCollectionForQuantity,
} from '@kingstinct/react-native-healthkit';
import { HealthSection } from './HealthSection';

const ACCENT = '#D99A50';

afterEach(() => {
  jest.mocked(isHealthDataAvailable).mockReturnValue(false);
  jest.mocked(getRequestStatusForAuthorization).mockResolvedValue(1);
  jest.mocked(queryStatisticsCollectionForQuantity).mockResolvedValue([] as never);
});

describe('Progress’s Health tab', () => {
  it('is the real steps alone in a release build -- no sample data', async () => {
    jest.mocked(isHealthDataAvailable).mockReturnValue(true);
    jest.mocked(getRequestStatusForAuthorization).mockResolvedValue(2);
    const now = new Date();
    jest.mocked(queryStatisticsCollectionForQuantity).mockResolvedValue([
      {
        startDate: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
        sumQuantity: { unit: 'count', quantity: 4210 },
      },
    ] as never);
    render(<HealthSection accent={ACCENT} onOpen={jest.fn()} preview={false} />);

    await waitFor(() =>
      expect(screen.getByTestId('progress-steps-today')).toHaveTextContent(/4,210/),
    );
    expect(screen.queryByTestId('health-overview')).toBeNull();
    expect(screen.queryByText(/sample data/)).toBeNull();
  });

  it('is the Health prototype in a development build, its steps the real ones', async () => {
    render(<HealthSection accent={ACCENT} onOpen={jest.fn()} preview />);

    expect(screen.getByTestId('health-overview')).toBeTruthy();
    expect(screen.getByTestId('health-sample-note')).toHaveTextContent(/except your steps/);
    await waitFor(() =>
      expect(screen.getByTestId('health-activity-source')).toHaveTextContent(/Apple Health/),
    );
  });
});
