/**
 * A failed request leaves no invite code in the journal (AC04 review).
 *
 * The response interceptor logs every failure with its URL, and an invite code
 * travels in the path: /native/invite/<code>/join. Whoever reads the code can
 * join the project, so the journal keeps the path with the code redacted.
 */
let mockResponseRejected: (error: any) => Promise<unknown>;
jest.mock('axios', () => ({
  create: () => ({
    post: jest.fn(),
    interceptors: {
      request: { use: jest.fn() },
      response: { use: (_ok: unknown, rejected: any) => { mockResponseRejected = rejected; } },
    },
  }),
  post: jest.fn(),
}));
jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn() }));

import '../api';

it('logs a network failure of joinProject without the invite code', async () => {
  const errorSpy = jest.spyOn(console, 'error').mockImplementation();
  const error: any = new Error('Network Error');
  error.name = 'AxiosError';
  error.isAxiosError = true;
  error.code = 'ERR_NETWORK';
  error.config = { method: 'post', url: '/native/invite/ABCD2345/join', headers: {} };

  await expect(mockResponseRejected(error)).rejects.toBe(error);

  const out = errorSpy.mock.calls.map((args) => args.map((a) => JSON.stringify(a)).join(' ')).join('\n');
  expect(errorSpy).toHaveBeenCalled();
  expect(out).not.toContain('ABCD2345');
  expect(out).toContain('/native/invite/[redacted]/join');
  errorSpy.mockRestore();
});
