import { jest } from '@jest/globals';
import net from 'node:net';

const forbidden = jest.fn(() => {
  throw new Error('Route inventory must not access runtime resources');
});

jest.unstable_mockModule('../database/db.js', () => ({
  default: {
    get: forbidden,
    all: forbidden,
    run: forbidden,
    transaction: forbidden,
  },
  initDatabase: forbidden,
  testConnection: forbidden,
  isPostgres: false,
}));
jest.unstable_mockModule('../config/env.js', () => {
  forbidden();
  return {};
});

// Traverse every mounting path, including aliases which share one router.
// Inspecting only app-level middleware would miss the native sub-routers.
function requestHandlers(stack, parentPath = 'app') {
  const handlers = [];
  for (const [index, layer] of stack.entries()) {
    const location = `${parentPath}/${layer.route?.path ?? layer.name ?? index}`;
    if (typeof layer.handle === 'function') {
      handlers.push({ location, handler: layer.handle });
    }
    if (layer.route?.stack) {
      handlers.push(...requestHandlers(layer.route.stack, location));
    }
    if (layer.handle?.stack) {
      handlers.push(...requestHandlers(layer.handle.stack, location));
    }
  }
  return handlers;
}

test('every mounted async request handler has an Express rejection boundary', async () => {
  const originalSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'synthetic-route-inventory-secret';
  const connect = jest.spyOn(net.Socket.prototype, 'connect').mockImplementation(forbidden);
  const listen = jest.spyOn(net.Server.prototype, 'listen').mockImplementation(forbidden);

  try {
    const { createApp } = await import('../app.js');
    const handlers = requestHandlers(createApp()._router.stack);
    const unprotected = handlers
      .filter(({ handler }) => handler.constructor.name === 'AsyncFunction')
      .map(({ location }) => location);
    const protectedPaths = handlers
      .filter(({ handler }) => handler.name === 'asyncRequestHandler');

    expect(unprotected).toEqual([]);
    expect(protectedPaths.length).toBeGreaterThan(60);
    expect(forbidden).not.toHaveBeenCalled();
  } finally {
    connect.mockRestore();
    listen.mockRestore();
    if (originalSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalSecret;
  }
});
