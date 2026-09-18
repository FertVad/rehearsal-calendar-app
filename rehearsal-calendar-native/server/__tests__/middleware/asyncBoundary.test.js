import { jest } from '@jest/globals';

jest.unstable_mockModule('../../utils/logger.js', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

const { asyncHandler } = await import('../../middleware/asyncHandler.js');
const { errorHandler } = await import('../../middleware/errorHandler.js');

function response(headersSent = false) {
  const res = { headersSent };
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

describe('async request boundary', () => {
  test.each(['throw', 'reject'])('%s forwards one error and consumes the rejection', async (failure) => {
    const error = new Error('Synthetic dependency failure');
    const next = jest.fn();
    const handler = asyncHandler(() => {
      if (failure === 'throw') throw error;
      return Promise.reject(error);
    });

    await expect(handler({}, response(), next)).resolves.toBeUndefined();

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith(error);
  });

  test('a successful response does not advance the middleware chain', async () => {
    const req = { userId: 7 };
    const res = response();
    const next = jest.fn();
    const handler = asyncHandler(async (request, reply) => {
      reply.json({ userId: request.userId });
    });

    await handler(req, res, next);

    expect(res.json).toHaveBeenCalledWith({ userId: 7 });
    expect(next).not.toHaveBeenCalled();
  });

  test('middleware controls its own successful next call', async () => {
    const next = jest.fn();
    const handler = asyncHandler(async (_req, _res, advance) => {
      advance();
    });

    await handler({}, response(), next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
  });

  test.each([undefined, null, false, 0, '', 'route', 'router', 'dependency rejected'])(
    'a non-Error rejection (%p) cannot become an Express success or routing sentinel',
    async (reason) => {
      const next = jest.fn();
      const handler = asyncHandler(() => Promise.reject(reason));

      await expect(handler({}, response(), next)).resolves.toBeUndefined();

      expect(next).toHaveBeenCalledTimes(1);
      expect(next.mock.calls[0][0]).toBeInstanceOf(Error);
    },
  );
});

describe('terminal HTTP error boundary', () => {
  test('delegates after headers were sent without attempting another response', () => {
    const error = new Error('Failure after response started');
    const res = response(true);
    const next = jest.fn();

    errorHandler(error, {}, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith(error);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  test('returns a generic 500 without dependency messages, stack or details', () => {
    const error = Object.assign(new Error('database password=synthetic-secret'), {
      code: '42P01',
      detail: 'private schema information',
      status: 500,
      expose: true,
    });
    const res = response();
    const next = jest.fn();

    errorHandler(error, {}, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledTimes(1);
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
    expect(next).not.toHaveBeenCalled();
  });

  test.each([
    [400, 'entity.parse.failed', 'Bad Request'],
    [413, 'entity.too.large', 'Payload Too Large'],
  ])('parser error %i keeps its status and a safe standard message', (status, type, message) => {
    const error = Object.assign(new Error('Unexpected token in private request body'), {
      status,
      statusCode: status,
      type,
      expose: true,
      body: '{"password":"synthetic-private-value"',
    });
    const res = response();
    const next = jest.fn();

    errorHandler(error, {}, res, next);

    expect(res.status).toHaveBeenCalledWith(status);
    expect(res.json).toHaveBeenCalledWith({ error: message });
    expect(next).not.toHaveBeenCalled();
  });

  test.each([undefined, null, 0, 200, 399, 600, '400', Number.NaN, 400.5])(
    'invalid error status %p falls back to a generic 500',
    (status) => {
      const error = Object.assign(new Error('Internal implementation detail'), { status });
      const res = response();

      errorHandler(error, {}, res, jest.fn());

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
    },
  );
});
