# 🚀 Development Roadmap - Rehearsal Calendar App

Last Updated: 2025-11-26

---

## 🔴 Phase 1: Critical Functionality (High Priority)

### 1. Availability Slots Validation ✅ COMPLETED
- [x] Add validation: start time < end time
- [x] Prevent saving invalid slots
- [x] Show error message with visual feedback
- [x] Add validation for overlapping slots on same day
- [x] Test on iOS (working after rebuild)
- [x] Add server-side validation
- [ ] Test on Android (optional)

**Files modified:**
- `src/features/availability/screens/AvailabilityScreen.tsx` ✅
- `server/routes/availability.js` ✅ (server-side validation added)

**What was implemented:**
- Client-side validation with real-time error display
- Detailed validation alerts with specific error messages
- Server-side validation to prevent API bypass
- Both start < end time validation and overlap detection

---

### 2. Rehearsal Booking Logic
- [ ] Show participant availability when creating rehearsal
- [ ] Display warnings if participant is busy
- [ ] Auto-block availability slots after creating rehearsal
- [ ] Suggest optimal time slots based on all participants' availability
- [ ] Add conflict detection algorithm

**Files to modify:**
- `src/features/calendar/screens/AddRehearsalScreen.tsx`
- `server/routes/native.js` (rehearsal creation endpoint)
- New: `server/utils/availabilityChecker.js`

---

### 3. Rehearsal Detail Page
- [ ] Create new screen: `RehearsalDetailScreen.tsx`
- [ ] Show full info: project, time, location, participants
- [ ] Display RSVP responses list (confirmed/declined/tentative)
- [ ] Add RSVP buttons (Accept/Decline/Maybe)
- [ ] Edit capability for admins
- [ ] Navigation from calendar cards

**Files to create:**
- `src/features/calendar/screens/RehearsalDetailScreen.tsx`
- `src/features/calendar/components/RSVPButton.tsx`

**Files to modify:**
- `src/navigation/index.tsx` (add route)
- `server/routes/native.js` (add endpoints if needed)

---

### 4. Participant Selection for Rehearsals
- [ ] Add participant selection UI when creating rehearsal
- [ ] Show all project members with checkboxes
- [ ] Display availability status for each participant
- [ ] Mark required participants
- [ ] Add "Only Available" filter
- [ ] Show participant roles (actor, director, tech)

**Files to modify:**
- `src/features/calendar/screens/AddRehearsalScreen.tsx`
- New: `src/features/calendar/components/ParticipantSelector.tsx`

---

## 🟡 Phase 2: UX Improvements (Medium Priority)

### 5. Improve Home Page (Calendar Screen)
- [ ] Redesign rehearsal cards with better layout
- [ ] Add status indicator (confirmed/pending)
- [ ] Show participant count (5/10 confirmed)
- [ ] Color coding by status
- [ ] Add icons for location and time
- [ ] Implement filter by project
- [ ] Add calendar view (not just list)
- [ ] Quick RSVP from card
- [ ] Pull-to-refresh functionality

**Files to modify:**
- `src/features/calendar/screens/CalendarScreen.tsx`
- `src/features/calendar/components/RehearsalCard.tsx`

---

### 6. Improve Project Detail Page
- [ ] Better project information layout
- [ ] Add statistics (rehearsals count, members count)
- [ ] Project settings section (for admins)
- [ ] Activity history
- [ ] Export schedule functionality
- [ ] Archive old rehearsals

**Files to modify:**
- `src/features/projects/screens/ProjectDetailScreen.tsx`

---

### 7. Update Bottom Navigation Menu
- [ ] Improve design (icons, spacing, colors)
- [ ] Fix tab titles ("Дом" → "Home", etc.)
- [ ] Add badge for pending rehearsals count
- [ ] Add haptic feedback on press
- [ ] Ensure icons match app style

**Files to modify:**
- `src/navigation/index.tsx`

---

### 8. User Onboarding
- [ ] Create onboarding flow for first-time users
- [ ] Add tutorial slides
- [ ] Tooltips for main features
- [ ] Empty states with call-to-action
- [ ] Skip option

**Files to create:**
- `src/features/onboarding/screens/OnboardingScreen.tsx`
- `src/features/onboarding/components/OnboardingSlide.tsx`

---

## 🟢 Phase 3: Localization & Polish (Low Priority)

### 9. English Translation (i18n)
- [ ] Install i18n library (react-i18next)
- [ ] Create translation files structure
- [ ] Extract all UI strings to translation files
- [ ] Translate to English
- [ ] Translate server response messages
- [ ] Add language selector in profile
- [ ] Support multiple languages (en, ru, he)

**Files to create:**
- `src/i18n/index.ts`
- `src/i18n/locales/en.json`
- `src/i18n/locales/ru.json`

**Files to modify:**
- All screen files
- `server/routes/*.js` (response messages)

---

### 10. Push Notifications
- [ ] Set up Expo Notifications
- [ ] Add push token registration
- [ ] Notification: 1 day before rehearsal
- [ ] Notification: 1 hour before rehearsal
- [ ] Notification: RSVP reminder
- [ ] Notification: time/location changed
- [ ] Notification settings in profile

**Files to create:**
- `src/services/notificationService.ts`
- `server/services/pushNotificationService.js`

---

### 11. Search & Filtering
- [ ] Search rehearsals by date/project/location
- [ ] Filter by status (upcoming, past, confirmed)
- [ ] Sort options (date, status, project)
- [ ] Search UI component

**Files to create:**
- `src/shared/components/SearchBar.tsx`
- `src/shared/components/FilterModal.tsx`

---

### 12. Profile Enhancements
- [ ] Edit profile (name, avatar)
- [ ] Notification settings
- [ ] Default timezone setting
- [ ] User statistics (rehearsal participation)
- [ ] Change password

**Files to modify:**
- `src/features/profile/screens/ProfileScreen.tsx`
- New: `src/features/profile/screens/EditProfileScreen.tsx`

---

## 🎯 Phase 4: Advanced Features (Future)

### 13. Offline Mode
- [ ] Implement AsyncStorage caching
- [ ] Sync on connection restore
- [ ] Connection status indicator
- [ ] Queue actions when offline

---

### 14. Calendar Integration
- [ ] Export to Google Calendar
- [ ] Export to Apple Calendar
- [ ] Generate .ics files
- [ ] Two-way sync (future)

---

### 15. Group Chat
- [ ] Project chat feature
- [ ] Rehearsal-specific discussions
- [ ] File sharing
- [ ] Media support

---

### 16. Analytics Dashboard
- [ ] Attendance statistics
- [ ] Project analytics
- [ ] Export reports (PDF/Excel)
- [ ] Admin dashboard

---

## 📝 Notes

### Current Tech Stack
- **Frontend**: React Native, Expo SDK 54
- **Navigation**: React Navigation
- **Backend**: Node.js, Express
- **Database**: PostgreSQL
- **Authentication**: JWT

### Key Files Reference
```
src/
├── features/
│   ├── auth/
│   ├── calendar/
│   ├── projects/
│   ├── availability/
│   └── profile/
├── navigation/
├── shared/
│   ├── components/
│   ├── constants/
│   └── services/
└── contexts/

server/
├── routes/
│   ├── native.js
│   ├── availability.js
│   └── auth.js
├── database/
└── middleware/
```

---

## 🏁 Completion Tracking

**Phase 1:** 0/4 ☐☐☐☐
**Phase 2:** 0/5 ☐☐☐☐☐
**Phase 3:** 0/4 ☐☐☐☐
**Phase 4:** 0/4 ☐☐☐☐

**Overall Progress:** 0/17 (0%)

---

## 🎯 Next Steps

1. **Start with:** Availability Slots Validation
2. **Then:** Rehearsal Detail Page
3. **Then:** Participant Selection

---

**Last worked on:** Phase 1, Task 1 (Not started)
