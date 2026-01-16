/**
 * Mock data generators for tests
 */

export const mockUser = (overrides = {}) => ({
  id: 1,
  email: 'test@example.com',
  name: 'Test User',
  timezone: 'America/New_York',
  created_at: new Date().toISOString(),
  ...overrides,
});

export const mockProject = (overrides = {}) => ({
  id: 1,
  name: 'Test Project',
  description: 'A test project',
  created_at: new Date().toISOString(),
  ...overrides,
});

export const mockRehearsal = (overrides = {}) => ({
  id: 1,
  project_id: 1,
  title: 'Test Rehearsal',
  location: 'Test Location',
  start_time: new Date().toISOString(),
  end_time: new Date(Date.now() + 3600000).toISOString(), // 1 hour later
  notes: 'Test notes',
  created_at: new Date().toISOString(),
  ...overrides,
});

export const mockRSVP = (overrides = {}) => ({
  id: 1,
  rehearsal_id: 1,
  user_id: 1,
  response_type: 'confirmed',
  created_at: new Date().toISOString(),
  ...overrides,
});

export const mockAvailability = (overrides = {}) => ({
  id: 1,
  user_id: 1,
  date: new Date().toISOString().split('T')[0],
  start_time: '09:00',
  end_time: '17:00',
  is_all_day: false,
  source: 'manual',
  created_at: new Date().toISOString(),
  ...overrides,
});

export const mockMember = (overrides = {}) => ({
  id: 1,
  user_id: 1,
  project_id: 1,
  role: 'member',
  joined_at: new Date().toISOString(),
  ...overrides,
});

export const mockInvite = (overrides = {}) => ({
  id: 1,
  project_id: 1,
  code: 'test-invite-code',
  created_by: 1,
  created_at: new Date().toISOString(),
  expires_at: new Date(Date.now() + 86400000).toISOString(), // 24 hours later
  ...overrides,
});
