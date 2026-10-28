/**
 * A request that sends email waits for it (review of T-130).
 *
 * The server sends each email inside the request, one after another, and gives
 * each up to SEND_TIMEOUT_MS. A client that gives up sooner drops the answer
 * while the codes are already issued: the person is told it failed and gets
 * no fields for codes that are in their mailbox. Each such request waits for
 * every email it sends plus the ordinary request time.
 */
import fs from 'fs';
import path from 'path';

const mockPost = jest.fn((..._args: any[]) => Promise.resolve({ data: {} }));
jest.mock('axios', () => ({
  create: () => ({
    post: (...args: any[]) => mockPost(...args),
    interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
  }),
}));
jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn() }));

import { authAPI } from '../api';

// The server's limit, read from the server, so the two cannot drift apart.
const transport = fs.readFileSync(
  path.join(__dirname, '../../../../server/services/email/transport.js'), 'utf8');
const SEND_TIMEOUT_MS = Number(/const SEND_TIMEOUT_MS = (\d+);/.exec(transport)?.[1]);
const DEFAULT_TIMEOUT_MS = 10000;

beforeEach(() => mockPost.mockClear());

it.each([
  ['register', () => authAPI.register('a@b.c', 'long-enough-1', 'A'), 1],
  ['resendVerification', () => authAPI.resendVerification('a@b.c', 'long-enough-1'), 1],
  ['requestPasswordReset', () => authAPI.requestPasswordReset('a@b.c'), 1],
  ['requestEmailChange', () => authAPI.requestEmailChange('new@b.c', 'long-enough-1'), 2],
  ['confirmEmailChange', () => authAPI.confirmEmailChange('222222', '111111'), 1],
] as const)('%s waits for the emails it sends and for the request itself', async (_name, call, emails) => {
  expect(SEND_TIMEOUT_MS).toBeGreaterThan(0);
  await call();
  const config = mockPost.mock.calls[0][2];
  expect(config?.timeout).toBeGreaterThanOrEqual(emails * SEND_TIMEOUT_MS + DEFAULT_TIMEOUT_MS);
});
