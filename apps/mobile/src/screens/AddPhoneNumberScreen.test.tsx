import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useAuth } from '../auth/AuthProvider';
import { useProfile } from '../profile/ProfileProvider';
import { AddPhoneNumberScreen } from './AddPhoneNumberScreen';

jest.mock('../auth/AuthProvider', () => ({ useAuth: jest.fn() }));
jest.mock('../profile/ProfileProvider', () => ({ useProfile: jest.fn() }));

const signOut = jest.fn();
const updateProfile = jest.fn();

beforeEach(() => {
  signOut.mockReset().mockResolvedValue(undefined);
  updateProfile.mockReset().mockResolvedValue({});
  (useAuth as jest.Mock).mockReturnValue({ signOut });
  (useProfile as jest.Mock).mockReturnValue({
    profile: { country: 'CA', phoneNumber: null },
    updateProfile,
  });
});

describe('AddPhoneNumberScreen', () => {
  it('saves their number, read as one from their own country', async () => {
    render(<AddPhoneNumberScreen />);

    expect(screen.getByTestId('add-phone-number-save')).toBeDisabled();
    fireEvent.changeText(screen.getByTestId('add-phone-number-input'), '(604) 555-1234');
    await act(async () => {
      fireEvent.press(screen.getByTestId('add-phone-number-save'));
    });

    expect(updateProfile).toHaveBeenCalledWith({ phoneNumber: '+16045551234' });
  });

  it('takes only a real number', () => {
    render(<AddPhoneNumberScreen />);

    fireEvent.changeText(screen.getByTestId('add-phone-number-input'), '555 12');

    expect(screen.getByTestId('add-phone-number-save')).toBeDisabled();
    expect(updateProfile).not.toHaveBeenCalled();
  });

  it('says so when the number does not save', async () => {
    updateProfile.mockRejectedValue(new Error('offline'));
    render(<AddPhoneNumberScreen />);

    fireEvent.changeText(screen.getByTestId('add-phone-number-input'), '604 555 1234');
    await act(async () => {
      fireEvent.press(screen.getByTestId('add-phone-number-save'));
    });

    expect(screen.getByTestId('add-phone-number-error')).toHaveTextContent('offline');
  });

  it('can only be left by signing out', () => {
    render(<AddPhoneNumberScreen />);

    fireEvent.press(screen.getByTestId('add-phone-number-sign-out'));

    expect(signOut).toHaveBeenCalled();
  });
});
