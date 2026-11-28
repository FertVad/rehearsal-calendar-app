/**
 * The JS half of the install postback (T-424): it asks the native module,
 * and a failure there is a warning in the log, never an error out of the
 * app's start. Off iOS, or without the module (Jest, Expo Go), it does nothing.
 */
import { NativeModules, Platform } from 'react-native';
import { registerInstall } from '../attribution';
import { logger } from '../../utils/logger';

const modules = NativeModules as Record<string, unknown>;

afterEach(() => {
  delete modules.RehearslyAttribution;
  (Platform as { OS: string }).OS = 'ios';
  jest.restoreAllMocks();
});

it('asks the native module once', async () => {
  const install = jest.fn().mockResolvedValue(null);
  modules.RehearslyAttribution = { install };
  await registerInstall();
  expect(install).toHaveBeenCalledTimes(1);
  expect(install).toHaveBeenCalledWith();
});

it('logs a refused value as a warning and resolves', async () => {
  const warn = jest.spyOn(logger, 'warn').mockImplementation(() => undefined);
  modules.RehearslyAttribution = { install: jest.fn().mockRejectedValue(new Error('SKANErrorDomain 10')) };
  await expect(registerInstall()).resolves.toBeUndefined();
  expect(warn).toHaveBeenCalledWith('[Attribution] the install conversion value was not taken:', expect.any(Error));
});

it('does nothing without the module or off iOS', async () => {
  await expect(registerInstall()).resolves.toBeUndefined();
  const install = jest.fn();
  modules.RehearslyAttribution = { install };
  (Platform as { OS: string }).OS = 'android';
  await registerInstall();
  expect(install).not.toHaveBeenCalled();
});
