/**
 * The JS half of the install postback (T-424). Three outcomes, each in the log:
 * iOS took the value — `logger.debug`; iOS refused it, or the native module is
 * not there at all — `logger.warn` (a module that never registered would
 * otherwise leave the ads without installs, unnoticed). Off iOS nothing is
 * called and nothing logged. It never throws out of the app's start.
 */
import { NativeModules, Platform } from 'react-native';
import { registerInstall } from '../attribution';
import { logger } from '../../utils/logger';

const modules = NativeModules as Record<string, unknown>;

let debug: jest.SpyInstance;
let warn: jest.SpyInstance;

beforeEach(() => {
  debug = jest.spyOn(logger, 'debug').mockImplementation(() => undefined);
  warn = jest.spyOn(logger, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  delete modules.RehearslyAttribution;
  (Platform as { OS: string }).OS = 'ios';
  jest.restoreAllMocks();
});

it('asks the native module once and logs the value taken as debug', async () => {
  const install = jest.fn().mockResolvedValue(null);
  modules.RehearslyAttribution = { install };
  await registerInstall();
  expect(install).toHaveBeenCalledTimes(1);
  expect(install).toHaveBeenCalledWith();
  expect(debug).toHaveBeenCalledWith('[Attribution] the install conversion value was taken');
  expect(warn).not.toHaveBeenCalled();
});

it('logs a refused value as a warning and resolves', async () => {
  modules.RehearslyAttribution = { install: jest.fn().mockRejectedValue(new Error('SKANErrorDomain 10')) };
  await expect(registerInstall()).resolves.toBeUndefined();
  expect(warn).toHaveBeenCalledWith('[Attribution] the install conversion value was not taken:', expect.any(Error));
  expect(debug).not.toHaveBeenCalled();
});

it('warns on iOS when the native module is missing', async () => {
  await expect(registerInstall()).resolves.toBeUndefined();
  expect(warn).toHaveBeenCalledWith('[Attribution] the native module RehearslyAttribution is missing; no install postback');
  expect(debug).not.toHaveBeenCalled();
});

it('does nothing and logs nothing off iOS', async () => {
  const install = jest.fn();
  modules.RehearslyAttribution = { install };
  (Platform as { OS: string }).OS = 'android';
  await registerInstall();
  delete modules.RehearslyAttribution;
  await registerInstall();
  expect(install).not.toHaveBeenCalled();
  expect(warn).not.toHaveBeenCalled();
  expect(debug).not.toHaveBeenCalled();
});
