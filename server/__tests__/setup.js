/**
 * Jest setup file
 * Runs before all tests
 */
import { jest } from '@jest/globals';

// Set JWT_SECRET before any modules are imported
process.env.JWT_SECRET = 'test-secret-for-testing';
process.env.NODE_ENV = 'test';

// Make jest globally available
global.jest = jest;
