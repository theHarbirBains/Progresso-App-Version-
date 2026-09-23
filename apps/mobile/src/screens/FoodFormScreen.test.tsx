import { Alert } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../auth/AuthProvider';
import { uploadFoodPhoto } from '../lib/foodPhotoUpload';
import { createFood, updateFood } from '../nutrition/foodQueries';
import { expectNoBareText } from '../testUtils/expectNoBareText';
import { FoodFormScreen } from './FoodFormScreen';

jest.mock('../auth/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../nutrition/foodQueries', () => ({
  createFood: jest.fn(),
  updateFood: jest.fn(),
}));

jest.mock('../lib/foodPhotoUpload', () => ({
  uploadFoodPhoto: jest.fn(),
}));

const mockUseAuth = useAuth as jest.Mock;
const mockCreateFood = createFood as jest.Mock;
const mockUpdateFood = updateFood as jest.Mock;
const mockUploadFoodPhoto = uploadFoodPhoto as jest.Mock;

const ownedFood = {
  id: 'food-1',
  name: 'Chicken Breast',
  brand: 'Kirkland',
  barcode: '012345678905',
  imageUrl: 'https://images.example/chicken.jpg',
  servingSize: 100,
  servingUnit: 'g',
  calories: 165,
  proteinG: 31,
  carbsG: 0,
  fatG: 3.6,
  isActive: true,
};

beforeEach(() => {
  mockUseAuth.mockReturnValue({ user: { id: 'user-1' } });
  mockCreateFood.mockReset();
  mockUpdateFood.mockReset();
  mockUploadFoodPhoto.mockReset();
});

function fillRequiredFields() {
  fireEvent.changeText(screen.getByTestId('food-form-name'), 'Rice');
  fireEvent.changeText(screen.getByTestId('food-form-serving-size'), '100');
  fireEvent.changeText(screen.getByTestId('food-form-serving-unit'), 'g');
  fireEvent.changeText(screen.getByTestId('food-form-calories'), '130');
  fireEvent.changeText(screen.getByTestId('food-form-protein'), '2.7');
  fireEvent.changeText(screen.getByTestId('food-form-carbs'), '28');
  fireEvent.changeText(screen.getByTestId('food-form-fat'), '0.3');
}

describe('FoodFormScreen (create mode)', () => {
  it('disables Save until every required field is a valid, non-negative number', () => {
    render(<FoodFormScreen mode="create" onDone={jest.fn()} onCancel={jest.fn()} />);

    expect(screen.getByTestId('food-form-save').props.accessibilityState.disabled).toBe(true);

    fillRequiredFields();

    expect(screen.getByTestId('food-form-save').props.accessibilityState.disabled).toBe(false);
  });

  it('rejects a zero or negative serving size', () => {
    render(<FoodFormScreen mode="create" onDone={jest.fn()} onCancel={jest.fn()} />);

    fillRequiredFields();
    fireEvent.changeText(screen.getByTestId('food-form-serving-size'), '0');

    expect(screen.getByTestId('food-form-save').props.accessibilityState.disabled).toBe(true);
  });

  it('leaves brand/barcode optional and null when left blank', async () => {
    mockCreateFood.mockResolvedValue({ ...ownedFood, id: 'new-food-id' });
    const onDone = jest.fn();
    render(<FoodFormScreen mode="create" onDone={onDone} onCancel={jest.fn()} />);

    fillRequiredFields();
    await waitFor(() =>
      fireEvent.press(screen.getByTestId('food-form-save')),
    );

    await waitFor(() =>
      expect(mockCreateFood).toHaveBeenCalledWith('user-1', {
        name: 'Rice',
        brand: null,
        barcode: null,
        servingSize: 100,
        servingUnit: 'g',
        calories: 130,
        proteinG: 2.7,
        carbsG: 28,
        fatG: 0.3,
      }),
    );
    expect(onDone).toHaveBeenCalledWith({ ...ownedFood, id: 'new-food-id' });
  });

  it('trims name/brand/barcode and includes brand/barcode when provided', async () => {
    mockCreateFood.mockResolvedValue(ownedFood);
    render(<FoodFormScreen mode="create" onDone={jest.fn()} onCancel={jest.fn()} />);

    fillRequiredFields();
    fireEvent.changeText(screen.getByTestId('food-form-name'), '  Rice  ');
    fireEvent.changeText(screen.getByTestId('food-form-brand'), '  Kirkland  ');
    fireEvent.changeText(screen.getByTestId('food-form-barcode'), '  012345  ');

    await waitFor(() => fireEvent.press(screen.getByTestId('food-form-save')));

    await waitFor(() =>
      expect(mockCreateFood).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ name: 'Rice', brand: 'Kirkland', barcode: '012345' }),
      ),
    );
  });

  it('prefills the barcode from initialBarcode (Scan Barcode -> Product Not Found flow)', () => {
    render(
      <FoodFormScreen
        mode="create"
        initialBarcode="099999999999"
        onDone={jest.fn()}
        onCancel={jest.fn()}
      />,
    );

    expect(screen.getByTestId('food-form-barcode')).toHaveProp('value', '099999999999');
  });

  it('shows an error and does not call onDone when createFood fails', async () => {
    mockCreateFood.mockRejectedValue(new Error('network error'));
    const onDone = jest.fn();
    render(<FoodFormScreen mode="create" onDone={onDone} onCancel={jest.fn()} />);

    fillRequiredFields();
    await waitFor(() => fireEvent.press(screen.getByTestId('food-form-save')));

    expect(await screen.findByTestId('food-form-error')).toHaveTextContent('network error');
    expect(onDone).not.toHaveBeenCalled();
  });

  it('calls onCancel when the header X is pressed', () => {
    const onCancel = jest.fn();
    render(<FoodFormScreen mode="create" onDone={jest.fn()} onCancel={onCancel} />);

    fireEvent.press(screen.getByTestId('food-form-cancel'));

    expect(onCancel).toHaveBeenCalled();
  });

  it('never shows Deactivate/Reactivate in create mode', () => {
    render(<FoodFormScreen mode="create" onDone={jest.fn()} onCancel={jest.fn()} />);

    expect(screen.queryByTestId('food-form-toggle-active')).toBeNull();
  });
});

describe('FoodFormScreen (edit mode)', () => {
  it('prefills every field from the existing food', () => {
    render(<FoodFormScreen mode="edit" food={ownedFood} onDone={jest.fn()} onCancel={jest.fn()} />);

    expect(screen.getByTestId('food-form-name')).toHaveProp('value', 'Chicken Breast');
    expect(screen.getByTestId('food-form-brand')).toHaveProp('value', 'Kirkland');
    expect(screen.getByTestId('food-form-barcode')).toHaveProp('value', '012345678905');
    expect(screen.getByTestId('food-form-serving-size')).toHaveProp('value', '100');
    expect(screen.getByTestId('food-form-serving-unit')).toHaveProp('value', 'g');
    expect(screen.getByTestId('food-form-calories')).toHaveProp('value', '165');
    expect(screen.getByTestId('food-form-protein')).toHaveProp('value', '31');
    expect(screen.getByTestId('food-form-carbs')).toHaveProp('value', '0');
    expect(screen.getByTestId('food-form-fat')).toHaveProp('value', '3.6');
  });

  it('saves via updateFood with the food id and calls onDone with no argument', async () => {
    mockUpdateFood.mockResolvedValue(ownedFood);
    const onDone = jest.fn();
    render(<FoodFormScreen mode="edit" food={ownedFood} onDone={onDone} onCancel={jest.fn()} />);

    fireEvent.changeText(screen.getByTestId('food-form-calories'), '170');
    await waitFor(() => fireEvent.press(screen.getByTestId('food-form-save')));

    await waitFor(() =>
      expect(mockUpdateFood).toHaveBeenCalledWith(
        'food-1',
        expect.objectContaining({ calories: 170 }),
      ),
    );
    expect(onDone).toHaveBeenCalledWith();
  });

  it('shows Deactivate for an active food, toggling it via updateFood', async () => {
    mockUpdateFood.mockResolvedValue({ ...ownedFood, isActive: false });
    const onDone = jest.fn();
    render(<FoodFormScreen mode="edit" food={ownedFood} onDone={onDone} onCancel={jest.fn()} />);

    expect(screen.getByTestId('food-form-toggle-active')).toHaveTextContent('Deactivate');
    fireEvent.press(screen.getByTestId('food-form-toggle-active'));

    await waitFor(() =>
      expect(mockUpdateFood).toHaveBeenCalledWith('food-1', { isActive: false }),
    );
    expect(onDone).toHaveBeenCalled();
  });

  it('shows Reactivate for an inactive food', () => {
    render(
      <FoodFormScreen
        mode="edit"
        food={{ ...ownedFood, isActive: false }}
        onDone={jest.fn()}
        onCancel={jest.fn()}
      />,
    );

    expect(screen.getByTestId('food-form-toggle-active')).toHaveTextContent('Reactivate');
  });

  it('shows an error and does not call onDone when the toggle fails', async () => {
    mockUpdateFood.mockRejectedValue(new Error('network error'));
    const onDone = jest.fn();
    render(<FoodFormScreen mode="edit" food={ownedFood} onDone={onDone} onCancel={jest.fn()} />);

    fireEvent.press(screen.getByTestId('food-form-toggle-active'));

    expect(await screen.findByTestId('food-form-error')).toHaveTextContent('network error');
    expect(onDone).not.toHaveBeenCalled();
  });
});

describe('FoodFormScreen photo flow', () => {
  it('uploads a newly picked photo and includes its URL on save', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      buttons?.find((b) => b.text === 'Choose from Library')?.onPress?.();
    });
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValueOnce({
      canceled: false,
      assets: [{ uri: 'file://new-photo.jpg' }],
    });
    mockUploadFoodPhoto.mockResolvedValue('https://images.example/new-photo.jpg');
    mockCreateFood.mockResolvedValue(ownedFood);
    render(<FoodFormScreen mode="create" onDone={jest.fn()} onCancel={jest.fn()} />);

    fillRequiredFields();
    fireEvent.press(screen.getByTestId('food-form-photo-add'));
    await screen.findByTestId('food-form-photo-remove');

    await waitFor(() => fireEvent.press(screen.getByTestId('food-form-save')));

    expect(mockUploadFoodPhoto).toHaveBeenCalledWith('user-1', 'file://new-photo.jpg');
    await waitFor(() =>
      expect(mockCreateFood).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ imageUrl: 'https://images.example/new-photo.jpg' }),
      ),
    );
  });

  it('omits imageUrl on save when the existing photo is left untouched (never clears it)', async () => {
    mockUpdateFood.mockResolvedValue(ownedFood);
    render(<FoodFormScreen mode="edit" food={ownedFood} onDone={jest.fn()} onCancel={jest.fn()} />);

    await waitFor(() => fireEvent.press(screen.getByTestId('food-form-save')));

    await waitFor(() => expect(mockUpdateFood).toHaveBeenCalled());
    const [, input] = mockUpdateFood.mock.calls[0];
    expect('imageUrl' in input).toBe(false);
    expect(mockUploadFoodPhoto).not.toHaveBeenCalled();
  });

  it('sends imageUrl: null on save after Remove Photo, without uploading anything', async () => {
    mockUpdateFood.mockResolvedValue({ ...ownedFood, imageUrl: null });
    render(<FoodFormScreen mode="edit" food={ownedFood} onDone={jest.fn()} onCancel={jest.fn()} />);

    fireEvent.press(screen.getByTestId('food-form-photo-remove'));
    await waitFor(() => fireEvent.press(screen.getByTestId('food-form-save')));

    await waitFor(() =>
      expect(mockUpdateFood).toHaveBeenCalledWith(
        'food-1',
        expect.objectContaining({ imageUrl: null }),
      ),
    );
    expect(mockUploadFoodPhoto).not.toHaveBeenCalled();
  });

  it('shows a photo error and never opens the picker when permission is denied', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      buttons?.find((b) => b.text === 'Choose from Library')?.onPress?.();
    });
    (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValueOnce({
      granted: false,
    });
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockClear();
    render(<FoodFormScreen mode="create" onDone={jest.fn()} onCancel={jest.fn()} />);

    fireEvent.press(screen.getByTestId('food-form-photo-add'));

    expect(await screen.findByTestId('food-form-photo-error')).toHaveTextContent(
      /Photo library permission is required/,
    );
    expect(ImagePicker.launchImageLibraryAsync).not.toHaveBeenCalled();
  });
});

describe('FoodFormScreen -- renders no bare text', () => {
  it('renders no bare text outside <Text> in create mode', () => {
    render(<FoodFormScreen mode="create" onDone={jest.fn()} onCancel={jest.fn()} />);
    expectNoBareText();
  });

  it('renders no bare text outside <Text> in edit mode', () => {
    render(<FoodFormScreen mode="edit" food={ownedFood} onDone={jest.fn()} onCancel={jest.fn()} />);
    expectNoBareText();
  });
});
