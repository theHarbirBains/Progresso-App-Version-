import { requireOptionalNativeModule } from 'expo';
import { TurboModuleRegistry } from 'react-native';

// jest.setup.js stands this module in as "a real build"; here is the real one.
const { hasHealthKitNative, hasWidgetsNative } =
  jest.requireActual<typeof import('./nativeModules')>('./nativeModules');

jest.mock('expo', () => ({ requireOptionalNativeModule: jest.fn() }));

const optionalModule = requireOptionalNativeModule as jest.Mock;

afterEach(() => {
  jest.restoreAllMocks();
  optionalModule.mockReset();
});

describe('hasWidgetsNative', () => {
  it('is true in a build with expo-widgets and Expo UI', () => {
    optionalModule.mockImplementation((name: string) => ({ name }));
    expect(hasWidgetsNative()).toBe(true);
    expect(optionalModule).toHaveBeenCalledWith('ExpoWidgets');
    expect(optionalModule).toHaveBeenCalledWith('ExpoUI');
  });

  it('is false in Expo Go, which has neither', () => {
    optionalModule.mockReturnValue(null);
    expect(hasWidgetsNative()).toBe(false);
  });

  it('is false with Expo UI but not expo-widgets', () => {
    optionalModule.mockImplementation((name: string) => (name === 'ExpoUI' ? {} : null));
    expect(hasWidgetsNative()).toBe(false);
  });
});

describe('hasHealthKitNative', () => {
  it('is true in a build with Nitro modules, which Apple Health is built on', () => {
    const get = jest.spyOn(TurboModuleRegistry, 'get').mockReturnValue({} as never);
    expect(hasHealthKitNative()).toBe(true);
    expect(get).toHaveBeenCalledWith('NitroModules');
  });

  it('is false in Expo Go, which has no Nitro modules', () => {
    jest.spyOn(TurboModuleRegistry, 'get').mockReturnValue(null);
    expect(hasHealthKitNative()).toBe(false);
  });
});
