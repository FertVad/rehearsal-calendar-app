# Performance Analysis Report

## 🔴 Critical Issues

### 1. N+1 Query Problem - Multiple API Calls in Loops

#### Location 1: CalendarSyncSettingsScreen.tsx (lines 179-197)
```typescript
for (const project of projects) {
  try {
    const response = await rehearsalsAPI.getAll(project.id);
    // ...
  } catch (err) {
    console.error(`Failed to fetch rehearsals for project ${project.id}:`, err);
  }
}
```

**Problem**: If user has 5 projects, this makes 5 sequential API calls.

**Impact**:
- 5 projects × 200ms per request = 1000ms total loading time
- 10 projects × 200ms = 2000ms (2 seconds!)
- Blocks UI thread during sync

**Solution**: Create batch API endpoint
```typescript
// New endpoint: GET /api/native/rehearsals/batch?projectIds=1,2,3
const response = await rehearsalsAPI.getAllForProjects(projectIds);
```

#### Location 2: useRehearsals.ts (lines 52-66)
```typescript
if (filterProjectId === null) {
  const allRehearsals: Rehearsal[] = [];
  for (const project of projects) {
    try {
      const response = await rehearsalsAPI.getAll(project.id);
      // ...
    } catch (err) {
      console.error(`Failed to fetch rehearsals for project ${project.id}:`, err);
    }
  }
  fetchedRehearsals = allRehearsals;
}
```

**Problem**: Same N+1 issue when viewing "All Projects"

**Impact**:
- Called on every screen focus
- Affects main calendar view performance
- User sees loading spinner for 1-2 seconds every time

**Solution**: Same batch endpoint as above

#### Location 3: useRehearsals.ts (lines 92-128)
```typescript
await Promise.all(
  upcomingRehearsals.map(async (rehearsal) => {
    // ...
    if (isAdmin) {
      const res = await rehearsalsAPI.getResponses(rehearsal.id);
      // ...
    } else {
      const res = await rehearsalsAPI.getMyResponse(rehearsal.id);
      // ...
    }
  })
);
```

**Problem**: Makes N parallel requests for N rehearsals

**Impact**:
- 20 upcoming rehearsals = 20 simultaneous HTTP requests
- Can overwhelm server
- Some requests may timeout

**Solution**: Batch endpoint
```typescript
// GET /api/native/rehearsals/responses/batch?rehearsalIds=1,2,3
const responses = await rehearsalsAPI.getResponsesBatch(rehearsalIds);
```

## 🟡 Medium Priority Issues

### 4. Inefficient Calendar Event Sync Loop

**Location**: calendarSync.ts (line 294-306)
```typescript
for (let i = 0; i < rehearsals.length; i++) {
  const rehearsal = rehearsals[i];
  try {
    await syncRehearsalToCalendar(rehearsal, calendarId);
    result.success++;
  } catch (error) {
    result.failed++;
  }
  if (onProgress) {
    onProgress(i + 1, total);
  }
}
```

**Problem**: Sequential sync, one at a time

**Impact**:
- 50 rehearsals × 100ms per sync = 5 seconds total
- User has to wait with loading spinner

**Solution**: Batch operations
```typescript
// Sync in batches of 10
const BATCH_SIZE = 10;
for (let i = 0; i < rehearsals.length; i += BATCH_SIZE) {
  const batch = rehearsals.slice(i, i + BATCH_SIZE);
  await Promise.all(batch.map(r => syncRehearsalToCalendar(r, calendarId)));
  if (onProgress) {
    onProgress(i + batch.length, total);
  }
}
```

### 5. Missing React.memo on List Items

**Location**: TodayRehearsals.tsx

**Problem**: Each rehearsal card re-renders on any state change

**Solution**: Extract rehearsal card to separate memoized component
```typescript
const RehearsalCard = React.memo(({ rehearsal, onRSVP, ... }) => {
  // Card rendering logic
});
```

## 🟢 Minor Optimizations

### 6. Unnecessary Re-renders in Calendar Components

**Locations**: Various calendar components

**Solution**: Add more useMemo/useCallback where appropriate
```typescript
const sortedRehearsals = useMemo(
  () => rehearsals.sort((a, b) => a.date.localeCompare(b.date)),
  [rehearsals]
);
```

### 7. Large Bundle Size Check

Run bundle analysis:
```bash
npx expo export --dump-sourcemap
npx react-native-bundle-visualizer
```

## Recommended Implementation Priority

1. **CRITICAL** - Add batch API endpoints (reduces 10+ requests to 1)
2. **HIGH** - Implement batch calendar sync
3. **MEDIUM** - Add React.memo to list components
4. **LOW** - Add missing useMemo/useCallback

## Expected Performance Improvements

### Before Optimizations:
- Loading all projects: **2-3 seconds** (5 projects × 400-600ms)
- Calendar sync: **5-10 seconds** (50 events × 100-200ms)

### After Optimizations:
- Loading all projects: **400-600ms** (1 batch request)
- Calendar sync: **1-2 seconds** (batched operations)

**Total improvement: 5x-10x faster**
