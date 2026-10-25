import { act, fireEvent, render, screen } from '@testing-library/react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../auth/AuthProvider';
import { removeUnsentScreenshot, uploadFeedbackScreenshot } from '../feedback/screenshotUpload';
import { sendFeedback } from '../lib/feedbackApi';
import { expectNoBareText } from '../testUtils/expectNoBareText';
import { FeedbackFormScreen } from './FeedbackFormScreen';

jest.mock('../auth/AuthProvider', () => ({ useAuth: jest.fn() }));
jest.mock('../lib/feedbackApi', () => ({ sendFeedback: jest.fn() }));
jest.mock('../feedback/screenshotUpload', () => ({
  uploadFeedbackScreenshot: jest.fn(),
  removeUnsentScreenshot: jest.fn(),
}));
jest.mock('../feedback/deviceInfo', () => ({
  sentFrom: () => ({ appVersion: '1.4.0', buildNumber: '31', platform: 'ios', osVersion: '18.1' }),
  sentFromText: () => 'Progresso 1.4.0 (31) · iOS 18.1',
}));

const mockSend = sendFeedback as jest.Mock;
const mockUpload = uploadFeedbackScreenshot as jest.Mock;
const mockRemove = removeUnsentScreenshot as jest.Mock;
const navigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  addListener: jest.fn(() => jest.fn()),
};

function renderScreen() {
  return render(<FeedbackFormScreen navigation={navigation as never} route={{} as never} />);
}

function fill(title = 'Swipe skips a day', description = 'It went two days ahead.') {
  fireEvent.changeText(screen.getByTestId('feedback-title'), title);
  fireEvent.changeText(screen.getByTestId('feedback-description'), description);
}

async function send() {
  await act(async () => {
    fireEvent.press(screen.getByTestId('feedback-form-send'));
  });
}

beforeEach(() => {
  (useAuth as jest.Mock).mockReturnValue({
    user: { id: 'user-1' },
    session: { access_token: 'token-1' },
  });
  mockSend.mockReset().mockResolvedValue({ id: 'fb-1' });
  mockUpload.mockReset().mockResolvedValue('user-1/shot.jpg');
  mockRemove.mockReset();
  navigation.goBack.mockClear();
});

describe('FeedbackFormScreen', () => {
  it('needs a title and a description before it can be sent', () => {
    renderScreen();

    expect(screen.getByTestId('feedback-form-send').props.accessibilityState.disabled).toBe(true);
    fill('Swipe skips a day', '   ');
    expect(screen.getByTestId('feedback-form-send').props.accessibilityState.disabled).toBe(true);
    fill();
    expect(screen.getByTestId('feedback-form-send').props.accessibilityState.disabled).toBe(false);
    expectNoBareText();
  });

  it('sends the chosen category, the words and where it was sent from, then thanks them', async () => {
    renderScreen();
    expect(screen.getByTestId('feedback-sent-from')).toHaveTextContent(
      'Sent with Progresso 1.4.0 (31) · iOS 18.1.',
    );

    fireEvent.press(screen.getByTestId('feedback-category-feature'));
    fill('  Dark mode widget ', ' A darker Home Screen widget. ');
    await send();

    expect(mockSend).toHaveBeenCalledWith('token-1', {
      category: 'feature',
      title: 'Dark mode widget',
      description: 'A darker Home Screen widget.',
      appVersion: '1.4.0',
      buildNumber: '31',
      platform: 'ios',
      osVersion: '18.1',
    });
    expect(mockUpload).not.toHaveBeenCalled();
    expect(await screen.findByTestId('feedback-sent')).toHaveTextContent(
      /Thanks for your feedback/,
    );
    fireEvent.press(screen.getByTestId('feedback-sent-done'));
    expect(navigation.goBack).toHaveBeenCalled();
  });

  it('uploads a screenshot first, and sends its path', async () => {
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValueOnce({
      canceled: false,
      assets: [{ uri: 'file:///shot.png' }],
    });
    renderScreen();

    await act(async () => {
      fireEvent.press(screen.getByTestId('feedback-screenshot-add'));
    });
    expect(screen.getByTestId('feedback-screenshot-preview')).toBeTruthy();
    fill();
    await send();

    expect(mockUpload).toHaveBeenCalledWith('user-1', 'file:///shot.png');
    expect(mockSend).toHaveBeenCalledWith(
      'token-1',
      expect.objectContaining({ screenshotPath: 'user-1/shot.jpg' }),
    );
  });

  it('takes a removed screenshot out of what is sent', async () => {
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValueOnce({
      canceled: false,
      assets: [{ uri: 'file:///shot.png' }],
    });
    renderScreen();
    await act(async () => {
      fireEvent.press(screen.getByTestId('feedback-screenshot-add'));
    });

    fireEvent.press(screen.getByTestId('feedback-screenshot-remove'));
    fill();
    await send();

    expect(mockUpload).not.toHaveBeenCalled();
    expect(mockSend.mock.calls[0][1].screenshotPath).toBeUndefined();
  });

  it('says why it was not sent -- too many today, say -- and takes the screenshot back', async () => {
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValueOnce({
      canceled: false,
      assets: [{ uri: 'file:///shot.png' }],
    });
    mockSend.mockRejectedValue(
      new Error("You've sent a lot of feedback today. Try again tomorrow."),
    );
    renderScreen();
    await act(async () => {
      fireEvent.press(screen.getByTestId('feedback-screenshot-add'));
    });
    fill();
    await send();

    expect(screen.getByTestId('feedback-form-error')).toHaveTextContent(/Try again tomorrow/);
    expect(mockRemove).toHaveBeenCalledWith('user-1/shot.jpg');
    expect(screen.queryByTestId('feedback-sent')).toBeNull();
  });

  it('asks for photo access to add a screenshot', async () => {
    (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValueOnce({
      granted: false,
    });
    renderScreen();

    await act(async () => {
      fireEvent.press(screen.getByTestId('feedback-screenshot-add'));
    });

    expect(screen.getByTestId('feedback-form-error')).toHaveTextContent(/permission/);
  });
});
