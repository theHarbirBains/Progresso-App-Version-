import Constants from 'expo-constants';
import { sentFrom, sentFromText } from './deviceInfo';

const constants = Constants as unknown as {
  expoConfig: { version?: string } | null;
  nativeBuildVersion?: string | null;
};

afterEach(() => {
  constants.expoConfig = { version: undefined };
  constants.nativeBuildVersion = undefined;
});

describe('sentFrom', () => {
  it('captures the app version, build, platform and system version', () => {
    constants.expoConfig = { version: '1.4.0' };
    constants.nativeBuildVersion = '31';

    expect(sentFrom()).toMatchObject({ appVersion: '1.4.0', buildNumber: '31', platform: 'ios' });
    expect(sentFrom().osVersion).toEqual(expect.any(String));
  });

  it('leaves out what it cannot tell, never making it up', () => {
    constants.expoConfig = null;
    constants.nativeBuildVersion = null;

    const info = sentFrom();
    expect(info.appVersion).toBeUndefined();
    expect(info.buildNumber).toBeUndefined();
  });
});

describe('sentFromText', () => {
  it('says as much as is known', () => {
    expect(
      sentFromText({ appVersion: '1.4.0', buildNumber: '31', platform: 'ios', osVersion: '18.1' }),
    ).toBe('Progresso 1.4.0 (31) · iOS 18.1');
    expect(sentFromText({ platform: 'android', osVersion: '35' })).toBe('Android 35');
    expect(sentFromText({})).toBe('');
  });
});
