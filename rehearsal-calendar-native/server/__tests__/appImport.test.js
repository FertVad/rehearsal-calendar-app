import { jest } from '@jest/globals';
import net from 'node:net';

const forbidden = jest.fn(() => { throw new Error('App assembly must not initialize runtime resources'); });
jest.unstable_mockModule('../database/db.js', () => ({
  default: {}, initDatabase: forbidden, testConnection: forbidden, isPostgres: false,
}));
jest.unstable_mockModule('../config/env.js', () => { forbidden(); return {}; });

test('import and createApp do not load .env, initialize a DB, listen or connect', async () => {
  const connect = jest.spyOn(net.Socket.prototype, 'connect').mockImplementation(forbidden);
  const listen = jest.spyOn(net.Server.prototype, 'listen').mockImplementation(forbidden);
  try {
    const { createApp } = await import('../app.js');
    const first = createApp();
    const second = createApp();
    expect(typeof first).toBe('function');
    expect(second).not.toBe(first);
    expect(first.get('trust proxy')).toBe(1);
    expect(forbidden).not.toHaveBeenCalled();
  } finally {
    connect.mockRestore();
    listen.mockRestore();
  }
});
