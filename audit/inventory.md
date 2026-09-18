# Инвентаризация (метаданные; 2026-09-06)

Без запуска кода проекта. Большие зависимости исключены.

| Каталог | Файлы | Байты | Строки текстовых файлов |
|---|---:|---:|---:|
| . | 2 | 34577 | 784 |
| .claude | 2 | 28921 | 319 |
| .github/workflows | 1 | 2005 | 52 |
| .vercel | 2 | 608 | 1 |
| .vscode | 1 | 38 | 3 |
| rehearsal-calendar-native | 13 | 837111 | 22643 |
| rehearsal-calendar-native/android | 6 | 16480 | 0 |
| rehearsal-calendar-native/android/app | 36 | 2137832 | 0 |
| rehearsal-calendar-native/android/gradle | 2 | 44017 | 0 |
| rehearsal-calendar-native/assets | 5 | 2630864 | 0 |
| rehearsal-calendar-native/docs | 6 | 77529 | 2495 |
| rehearsal-calendar-native/ios | 6 | 73202 | 5 |
| rehearsal-calendar-native/ios/Rehearsly | 15 | 3928133 | 63 |
| rehearsal-calendar-native/ios/Rehearsly.xcodeproj | 4 | 28028 | 0 |
| rehearsal-calendar-native/ios/Rehearsly.xcworkspace | 2 | 13793 | 0 |
| rehearsal-calendar-native/scripts | 1 | 3904 | 126 |
| rehearsal-calendar-native/server | 8 | 365233 | 7393 |
| rehearsal-calendar-native/server/.vercel | 2 | 608 | 1 |
| rehearsal-calendar-native/server/__tests__ | 32 | 263700 | 7728 |
| rehearsal-calendar-native/server/config | 1 | 955 | 23 |
| rehearsal-calendar-native/server/constants | 2 | 2644 | 77 |
| rehearsal-calendar-native/server/database | 3 | 374281 | 464 |
| rehearsal-calendar-native/server/i18n | 1 | 9779 | 296 |
| rehearsal-calendar-native/server/middleware | 2 | 4366 | 136 |
| rehearsal-calendar-native/server/migrations | 23 | 36673 | 887 |
| rehearsal-calendar-native/server/public | 24 | 628557 | 2326 |
| rehearsal-calendar-native/server/routes | 14 | 126623 | 3673 |
| rehearsal-calendar-native/server/scripts | 2 | 18274 | 504 |
| rehearsal-calendar-native/server/services | 6 | 58216 | 1641 |
| rehearsal-calendar-native/server/utils | 8 | 22857 | 678 |
| rehearsal-calendar-native/src/__tests__ | 19 | 63919 | 2222 |
| rehearsal-calendar-native/src/contexts | 7 | 42366 | 1253 |
| rehearsal-calendar-native/src/features | 116 | 716148 | 22643 |
| rehearsal-calendar-native/src/hooks | 1 | 2253 | 71 |
| rehearsal-calendar-native/src/i18n | 11 | 125523 | 3177 |
| rehearsal-calendar-native/src/navigation | 3 | 17652 | 559 |
| rehearsal-calendar-native/src/shared | 50 | 245354 | 7193 |
| screens | 2 | 17943 | 134 |
| screens/shots | 17 | 4191145 | 48 |

## Исключённые деревья
- `.git`
- `rehearsal-calendar-native/.expo`
- `rehearsal-calendar-native/node_modules`
- `rehearsal-calendar-native/server/.expo`
- `rehearsal-calendar-native/server/node_modules`
- `rehearsal-calendar-native/ios/Pods`
- `rehearsal-calendar-native/ios/build`

## Текстовые файлы и число строк (не означает проверку)
- `CLAUDE.md`: 784
- `.vercel/project.json`: 1
- `.claude/settings.json`: 114
- `.claude/settings.local.json`: 205
- `screens/claude-design-brief.md`: 134
- `screens/shots/README.md`: 48
- `.github/workflows/rehearsal-reminders.yml`: 52
- `rehearsal-calendar-native/App.tsx`: 45
- `rehearsal-calendar-native/knip.json`: 25
- `rehearsal-calendar-native/app.json`: 100
- `rehearsal-calendar-native/jest.config.js`: 62
- `rehearsal-calendar-native/eas.json`: 36
- `rehearsal-calendar-native/package-lock.json`: 22183
- `rehearsal-calendar-native/package.json`: 66
- `rehearsal-calendar-native/tsconfig.json`: 6
- `rehearsal-calendar-native/index.ts`: 8
- `rehearsal-calendar-native/eslint.config.js`: 112
- `rehearsal-calendar-native/server/vercel.json`: 26
- `rehearsal-calendar-native/server/server.js`: 381
- `rehearsal-calendar-native/server/package-lock.json`: 6943
- `rehearsal-calendar-native/server/package.json`: 43
- `rehearsal-calendar-native/server/middleware/jwtMiddleware.js`: 91
- `rehearsal-calendar-native/server/middleware/adminAuth.js`: 45
- `rehearsal-calendar-native/server/database/db.js`: 161
- `rehearsal-calendar-native/server/database/init-native-schema.sql`: 303
- `rehearsal-calendar-native/server/.vercel/project.json`: 1
- `rehearsal-calendar-native/server/migrations/005-unique-imported-event.sql`: 26
- `rehearsal-calendar-native/server/migrations/adapt-calendar-tables-for-expo.sql`: 78
- `rehearsal-calendar-native/server/migrations/add-is-all-day-to-rehearsals.sql`: 13
- `rehearsal-calendar-native/server/migrations/fix-date-column-types.sql`: 13
- `rehearsal-calendar-native/server/migrations/create-push-reminders-table.sql`: 35
- `rehearsal-calendar-native/server/migrations/add-week-start-preference-sqlite.sql`: 14
- `rehearsal-calendar-native/server/migrations/migrate-availability-to-timestamptz.sql`: 97
- `rehearsal-calendar-native/server/migrations/add-pending-response-status.sql`: 15
- `rehearsal-calendar-native/server/migrations/add-rehearsal-responses-table.sql`: 24
- `rehearsal-calendar-native/server/migrations/003-notifications-timestamptz.sql`: 20
- `rehearsal-calendar-native/server/migrations/001-add-oauth-providers.sql`: 110
- `rehearsal-calendar-native/server/migrations/add-is-all-day-flag.sql`: 20
- `rehearsal-calendar-native/server/migrations/add-token-version.sql`: 5
- `rehearsal-calendar-native/server/migrations/002-create-push-tokens-postgres.sql`: 30
- `rehearsal-calendar-native/server/migrations/add-onboarding-completed.sql`: 10
- `rehearsal-calendar-native/server/migrations/add-week-start-preference.sql`: 17
- `rehearsal-calendar-native/server/migrations/004-trim-user-names.sql`: 26
- `rehearsal-calendar-native/server/migrations/drop-old-availability-columns.sql`: 85
- `rehearsal-calendar-native/server/migrations/drop-old-rehearsal-columns.sql`: 85
- `rehearsal-calendar-native/server/migrations/migrate-rehearsals-to-timestamptz.sql`: 83
- `rehearsal-calendar-native/server/migrations/add-rehearsal-title-description.sql`: 14
- `rehearsal-calendar-native/server/migrations/006-per-recipient-reminder-claims.sql`: 35
- `rehearsal-calendar-native/server/migrations/002-create-push-tokens-sqlite.sql`: 32
- `rehearsal-calendar-native/server/config/env.js`: 23
- `rehearsal-calendar-native/server/constants/timezone.js`: 30
- `rehearsal-calendar-native/server/constants/googleClients.js`: 47
- `rehearsal-calendar-native/server/utils/logger.js`: 51
- `rehearsal-calendar-native/server/utils/oauthVerification.js`: 127
- `rehearsal-calendar-native/server/utils/accountLinking.js`: 224
- `rehearsal-calendar-native/server/utils/timezone.js`: 155
- `rehearsal-calendar-native/server/utils/projectAuth.js`: 14
- `rehearsal-calendar-native/server/utils/names.js`: 22
- `rehearsal-calendar-native/server/utils/userSerializer.js`: 31
- `rehearsal-calendar-native/server/utils/htmlEscape.js`: 54
- `rehearsal-calendar-native/server/public/index.html`: 399
- `rehearsal-calendar-native/server/public/styles.css`: 561
- `rehearsal-calendar-native/server/public/support.html`: 312
- `rehearsal-calendar-native/server/public/legal.js`: 51
- `rehearsal-calendar-native/server/public/legal.css`: 148
- `rehearsal-calendar-native/server/public/i18n.js`: 173
- `rehearsal-calendar-native/server/public/privacy.html`: 682
- `rehearsal-calendar-native/server/__tests__/timezone.test.js`: 258
- `rehearsal-calendar-native/server/__tests__/setup.js`: 12
- `rehearsal-calendar-native/server/__tests__/middleware/jwtMiddleware.test.js`: 178
- `rehearsal-calendar-native/server/__tests__/database/transaction.test.js`: 95
- `rehearsal-calendar-native/server/__tests__/integration/calendarSync.integration.test.js`: 660
- `rehearsal-calendar-native/server/__tests__/integration/availability.integration.test.js`: 531
- `rehearsal-calendar-native/server/__tests__/integration/projects.integration.test.js`: 479
- `rehearsal-calendar-native/server/__tests__/integration/reminderScheduler.integration.test.js`: 297
- `rehearsal-calendar-native/server/__tests__/integration/setup.js`: 343
- `rehearsal-calendar-native/server/__tests__/integration/rehearsals.integration.test.js`: 489
- `rehearsal-calendar-native/server/__tests__/integration/invites.integration.test.js`: 462
- `rehearsal-calendar-native/server/__tests__/integration/rsvp.integration.test.js`: 339
- `rehearsal-calendar-native/server/__tests__/integration/rehearsalParticipants.integration.test.js`: 182
- `rehearsal-calendar-native/server/__tests__/integration/rsvpService.integration.test.js`: 171
- `rehearsal-calendar-native/server/__tests__/utils/googleAudience.test.js`: 137
- `rehearsal-calendar-native/server/__tests__/utils/testHelpers.js`: 116
- `rehearsal-calendar-native/server/__tests__/utils/names.test.js`: 34
- `rehearsal-calendar-native/server/__tests__/routes/htmlEscaping.test.js`: 54
- `rehearsal-calendar-native/server/__tests__/routes/projectDeletionCleanup.test.js`: 193
- `rehearsal-calendar-native/server/__tests__/routes/rehearsalById.test.js`: 176
- `rehearsal-calendar-native/server/__tests__/routes/authorization.test.js`: 227
- `rehearsal-calendar-native/server/__tests__/routes/accountDeletionCleanup.test.js`: 254
- `rehearsal-calendar-native/server/__tests__/routes/authLogin.test.js`: 179
- `rehearsal-calendar-native/server/__tests__/routes/membershipNotifications.test.js`: 189
- `rehearsal-calendar-native/server/__tests__/routes/rehearsalNotifications.test.js`: 372
- `rehearsal-calendar-native/server/__tests__/routes/memberRemoval.test.js`: 285
- `rehearsal-calendar-native/server/__tests__/routes/pushTokenOwnership.test.js`: 155
- `rehearsal-calendar-native/server/__tests__/routes/notifications.test.js`: 276
- `rehearsal-calendar-native/server/__tests__/routes/availabilityBulk.test.js`: 222
- `rehearsal-calendar-native/server/__tests__/routes/calendarMappingLookup.test.js`: 62
- `rehearsal-calendar-native/server/__tests__/routes/projectsInviteCode.test.js`: 86
- `rehearsal-calendar-native/server/__tests__/routes/membersAvailabilityRange.test.js`: 215
- `rehearsal-calendar-native/server/scripts/seed-demo.mjs`: 322
- `rehearsal-calendar-native/server/scripts/migrate.js`: 182
- `rehearsal-calendar-native/server/i18n/pushNotifications.js`: 296
- `rehearsal-calendar-native/server/routes/cron.js`: 67
- `rehearsal-calendar-native/server/routes/native.js`: 35
- `rehearsal-calendar-native/server/routes/auth.js`: 563
- `rehearsal-calendar-native/server/routes/admin.js`: 174
- `rehearsal-calendar-native/server/routes/native/bugReports.js`: 30
- `rehearsal-calendar-native/server/routes/native/pushTokens.js`: 127
- `rehearsal-calendar-native/server/routes/native/members.js`: 515
- `rehearsal-calendar-native/server/routes/native/invites.js`: 293
- `rehearsal-calendar-native/server/routes/native/availability.js`: 303
- `rehearsal-calendar-native/server/routes/native/projects.js`: 215
- `rehearsal-calendar-native/server/routes/native/rehearsals.js`: 381
- `rehearsal-calendar-native/server/routes/native/calendarSync.js`: 398
- `rehearsal-calendar-native/server/routes/native/notifications.js`: 113
- `rehearsal-calendar-native/server/routes/admin/dashboardPage.js`: 459
- `rehearsal-calendar-native/server/services/rehearsals/rehearsalService.js`: 587
- `rehearsal-calendar-native/server/services/rehearsals/slotService.js`: 152
- `rehearsal-calendar-native/server/services/rehearsals/rsvpService.js`: 165
- `rehearsal-calendar-native/server/services/notifications/notificationStore.js`: 206
- `rehearsal-calendar-native/server/services/notifications/reminderScheduler.js`: 182
- `rehearsal-calendar-native/server/services/notifications/pushNotificationService.js`: 349
- `rehearsal-calendar-native/docs/quick-reference.md`: 42
- `rehearsal-calendar-native/docs/api-standards.md`: 195
- `rehearsal-calendar-native/docs/api-documentation.md`: 1780
- `rehearsal-calendar-native/docs/known-issues.md`: 230
- `rehearsal-calendar-native/docs/README.md`: 40
- `rehearsal-calendar-native/docs/app-store-release.md`: 208
- `rehearsal-calendar-native/ios/Podfile.properties.json`: 5
- `rehearsal-calendar-native/ios/Rehearsly/Images.xcassets/Contents.json`: 6
- `rehearsal-calendar-native/ios/Rehearsly/Images.xcassets/AppIcon.appiconset/Contents.json`: 14
- `rehearsal-calendar-native/ios/Rehearsly/Images.xcassets/SplashScreenBackground.colorset/Contents.json`: 20
- `rehearsal-calendar-native/ios/Rehearsly/Images.xcassets/SplashScreenLegacy.imageset/Contents.json`: 23
- `rehearsal-calendar-native/scripts/check-secrets.sh`: 126
- `rehearsal-calendar-native/src/contexts/UnreadContext.tsx`: 132
- `rehearsal-calendar-native/src/contexts/SeenContext.tsx`: 110
- `rehearsal-calendar-native/src/contexts/I18nContext.tsx`: 74
- `rehearsal-calendar-native/src/contexts/ProjectContext.tsx`: 95
- `rehearsal-calendar-native/src/contexts/AuthContext.tsx`: 458
- `rehearsal-calendar-native/src/contexts/__tests__/UnreadContext.test.tsx`: 235
- `rehearsal-calendar-native/src/contexts/__tests__/SeenContext.test.tsx`: 149
- `rehearsal-calendar-native/src/features/smart-planner/types.ts`: 28
- `rehearsal-calendar-native/src/features/smart-planner/utils/availabilityMerger.ts`: 73
- `rehearsal-calendar-native/src/features/smart-planner/utils/slotGenerator.ts`: 310
- `rehearsal-calendar-native/src/features/smart-planner/utils/__tests__/slotGenerator.test.ts`: 255
- `rehearsal-calendar-native/src/features/smart-planner/utils/__tests__/availabilityMerger.test.ts`: 96
- `rehearsal-calendar-native/src/features/smart-planner/screens/SmartPlannerTabScreen.tsx`: 76
- `rehearsal-calendar-native/src/features/smart-planner/screens/SmartPlannerScreen.tsx`: 411
- `rehearsal-calendar-native/src/features/smart-planner/styles/smartPlannerScreenStyles.ts`: 182
- `rehearsal-calendar-native/src/features/smart-planner/styles/index.ts`: 1
- `rehearsal-calendar-native/src/features/smart-planner/components/SlotItem.tsx`: 110
- `rehearsal-calendar-native/src/features/smart-planner/components/MemberFilter.tsx`: 247
- `rehearsal-calendar-native/src/features/smart-planner/components/DayCard.tsx`: 112
- `rehearsal-calendar-native/src/features/smart-planner/components/__tests__/MemberFilter.test.tsx`: 122
- `rehearsal-calendar-native/src/features/smart-planner/hooks/useSmartPlanner.ts`: 214
- `rehearsal-calendar-native/src/features/calendar/utils/rehearsalFormatters.ts`: 13
- `rehearsal-calendar-native/src/features/calendar/screens/AddRehearsalScreen.tsx`: 394
- `rehearsal-calendar-native/src/features/calendar/screens/CalendarScreen.tsx`: 423
- `rehearsal-calendar-native/src/features/calendar/screens/RehearsalDetailsScreen.tsx`: 469
- `rehearsal-calendar-native/src/features/calendar/styles/calendarScreenStyles.ts`: 316
- `rehearsal-calendar-native/src/features/calendar/styles/addRehearsalScreenStyles.ts`: 195
- `rehearsal-calendar-native/src/features/calendar/styles/index.ts`: 2
- `rehearsal-calendar-native/src/features/calendar/components/TodayRehearsals.tsx`: 124
- `rehearsal-calendar-native/src/features/calendar/components/WeeklyCalendar.tsx`: 353
- `rehearsal-calendar-native/src/features/calendar/components/RehearsalCard.tsx`: 163
- `rehearsal-calendar-native/src/features/calendar/components/ActorSelector.tsx`: 350
- `rehearsal-calendar-native/src/features/calendar/components/TimeRecommendations.tsx`: 150
- `rehearsal-calendar-native/src/features/calendar/components/SmartPlannerButton.tsx`: 54
- `rehearsal-calendar-native/src/features/calendar/components/__tests__/TodayRehearsals.test.tsx`: 513
- `rehearsal-calendar-native/src/features/calendar/components/__tests__/ActorSelector.test.tsx`: 557
- `rehearsal-calendar-native/src/features/calendar/hooks/useAddRehearsalSubmit.ts`: 221
- `rehearsal-calendar-native/src/features/calendar/hooks/useAddRehearsalForm.ts`: 301
- `rehearsal-calendar-native/src/features/calendar/hooks/useTimeRecommendations.ts`: 76
- `rehearsal-calendar-native/src/features/calendar/hooks/useRehearsalAvailability.ts`: 99
- `rehearsal-calendar-native/src/features/calendar/hooks/useRehearsalMembers.ts`: 42
- `rehearsal-calendar-native/src/features/calendar/hooks/index.ts`: 7
- `rehearsal-calendar-native/src/features/calendar/hooks/useRehearsals.ts`: 179
- `rehearsal-calendar-native/src/features/calendar/hooks/useCalendarSync.ts`: 408
- `rehearsal-calendar-native/src/features/calendar/hooks/__tests__/useTimeRecommendations.test.ts`: 540
- `rehearsal-calendar-native/src/features/calendar/hooks/__tests__/useRehearsals.test.ts`: 422
- `rehearsal-calendar-native/src/features/calendar/hooks/__tests__/useAddRehearsalSubmit.test.ts`: 559
- `rehearsal-calendar-native/src/features/calendar/hooks/__tests__/useCalendarSync.test.ts`: 753
- `rehearsal-calendar-native/src/features/calendar/hooks/__tests__/useAddRehearsalForm.test.ts`: 464
- `rehearsal-calendar-native/src/features/auth/screens/RegisterScreen.tsx`: 174
- `rehearsal-calendar-native/src/features/auth/screens/LoginScreen.tsx`: 213
- `rehearsal-calendar-native/src/features/auth/styles/registerScreenStyles.ts`: 91
- `rehearsal-calendar-native/src/features/auth/styles/index.ts`: 2
- `rehearsal-calendar-native/src/features/auth/styles/loginScreenStyles.ts`: 105
- `rehearsal-calendar-native/src/features/projects/screens/ProjectsScreen.tsx`: 170
- `rehearsal-calendar-native/src/features/projects/screens/CreateProjectScreen.tsx`: 215
- `rehearsal-calendar-native/src/features/projects/screens/JoinProjectScreen.tsx`: 269
- `rehearsal-calendar-native/src/features/projects/screens/ProjectDetailScreen.tsx`: 675
- `rehearsal-calendar-native/src/features/projects/styles/projectsScreenStyles.ts`: 185
- `rehearsal-calendar-native/src/features/projects/styles/createProjectScreenStyles.ts`: 164
- `rehearsal-calendar-native/src/features/projects/styles/index.ts`: 4
- `rehearsal-calendar-native/src/features/projects/styles/projectDetailScreenStyles.ts`: 321
- `rehearsal-calendar-native/src/features/projects/styles/joinProjectScreenStyles.ts`: 121
- `rehearsal-calendar-native/src/features/projects/hooks/index.ts`: 1
- `rehearsal-calendar-native/src/features/projects/hooks/useInviteLink.ts`: 49
- `rehearsal-calendar-native/src/features/projects/hooks/__tests__/useInviteLink.test.ts`: 238
- `rehearsal-calendar-native/src/features/profile/screens/CalendarSyncSettingsScreen.tsx`: 620
- `rehearsal-calendar-native/src/features/profile/screens/ProfileScreen.tsx`: 556
- `rehearsal-calendar-native/src/features/profile/screens/EditProfileScreen.tsx`: 206
- `rehearsal-calendar-native/src/features/profile/styles/profileScreenStyles.ts`: 171
- `rehearsal-calendar-native/src/features/profile/styles/editProfileScreenStyles.ts`: 81
- `rehearsal-calendar-native/src/features/profile/styles/index.ts`: 3
- `rehearsal-calendar-native/src/features/profile/styles/calendarSyncSettingsScreenStyles.ts`: 430
- `rehearsal-calendar-native/src/features/availability/types/availability.ts`: 57
- `rehearsal-calendar-native/src/features/availability/types/index.ts`: 4
- `rehearsal-calendar-native/src/features/availability/constants/availabilityConstants.ts`: 26
- `rehearsal-calendar-native/src/features/availability/constants/index.ts`: 4
- `rehearsal-calendar-native/src/features/availability/utils/slotHelpers.ts`: 20
- `rehearsal-calendar-native/src/features/availability/utils/validationUtils.ts`: 69
- `rehearsal-calendar-native/src/features/availability/utils/calendarUtils.ts`: 183
- `rehearsal-calendar-native/src/features/availability/utils/index.ts`: 26
- `rehearsal-calendar-native/src/features/availability/utils/__tests__/displayedMode.test.ts`: 97
- `rehearsal-calendar-native/src/features/availability/screens/AvailabilityScreen.tsx`: 531
- `rehearsal-calendar-native/src/features/availability/styles/availabilityScreenStyles.ts`: 401
- `rehearsal-calendar-native/src/features/availability/styles/index.ts`: 4
- `rehearsal-calendar-native/src/features/availability/components/index.ts`: 6
- `rehearsal-calendar-native/src/features/availability/components/calendar/index.ts`: 4
- `rehearsal-calendar-native/src/features/availability/components/calendar/CalendarMonth.tsx`: 194
- `rehearsal-calendar-native/src/features/availability/components/modals/TimePickerModal.tsx`: 105
- `rehearsal-calendar-native/src/features/availability/components/modals/index.ts`: 4
- `rehearsal-calendar-native/src/features/availability/components/editor/EditorHeader.tsx`: 74
- `rehearsal-calendar-native/src/features/availability/components/editor/ModeInfo.tsx`: 47
- `rehearsal-calendar-native/src/features/availability/components/editor/TimeSlotsEditor.tsx`: 173
- `rehearsal-calendar-native/src/features/availability/components/editor/index.ts`: 8
- `rehearsal-calendar-native/src/features/availability/components/editor/ModeSelector.tsx`: 125
- `rehearsal-calendar-native/src/features/availability/components/editor/__tests__/TimeSlotsEditor.test.tsx`: 466
- `rehearsal-calendar-native/src/features/availability/components/editor/__tests__/ModeSelector.test.tsx`: 387
- `rehearsal-calendar-native/src/features/availability/hooks/useAvailabilityEditor.ts`: 267
- `rehearsal-calendar-native/src/features/availability/hooks/useAvailabilitySave.ts`: 217
- `rehearsal-calendar-native/src/features/availability/hooks/useAvailabilitySync.ts`: 117
- `rehearsal-calendar-native/src/features/availability/hooks/useAvailabilityData.ts`: 288
- `rehearsal-calendar-native/src/features/availability/hooks/index.ts`: 4
- `rehearsal-calendar-native/src/features/availability/hooks/__tests__/useAvailabilityEditor.test.ts`: 219
- `rehearsal-calendar-native/src/features/availability/hooks/__tests__/useAvailabilitySave.test.ts`: 464
- `rehearsal-calendar-native/src/features/availability/hooks/__tests__/useAvailabilityData.test.ts`: 494
- `rehearsal-calendar-native/src/features/availability/hooks/__tests__/useAvailabilityDataMultiDay.test.ts`: 143
- `rehearsal-calendar-native/src/features/availability/hooks/__tests__/useAvailabilityDataAllDay.test.ts`: 228
- `rehearsal-calendar-native/src/features/availability/hooks/__tests__/useAvailabilityOffline.test.ts`: 93
- `rehearsal-calendar-native/src/features/notifications/screens/NotificationsScreen.tsx`: 273
- `rehearsal-calendar-native/src/features/notifications/styles/notificationsScreenStyles.ts`: 132
- `rehearsal-calendar-native/src/features/onboarding/index.ts`: 5
- `rehearsal-calendar-native/src/features/onboarding/navigation/OnboardingNavigator.tsx`: 34
- `rehearsal-calendar-native/src/features/onboarding/screens/WelcomeScreen.tsx`: 128
- `rehearsal-calendar-native/src/features/onboarding/screens/NotificationsScreen.tsx`: 98
- `rehearsal-calendar-native/src/features/onboarding/screens/WeekStartScreen.tsx`: 155
- `rehearsal-calendar-native/src/features/onboarding/screens/CalendarSyncScreen.tsx`: 467
- `rehearsal-calendar-native/src/features/onboarding/screens/index.ts`: 4
- `rehearsal-calendar-native/src/features/onboarding/components/OnboardingStep.tsx`: 197
- `rehearsal-calendar-native/src/features/onboarding/components/WeekPreview.tsx`: 59
- `rehearsal-calendar-native/src/features/onboarding/components/OnboardingProgress.tsx`: 47
- `rehearsal-calendar-native/src/features/onboarding/components/index.ts`: 3
- `rehearsal-calendar-native/src/features/onboarding/hooks/useOnboarding.ts`: 43
- `rehearsal-calendar-native/src/features/onboarding/hooks/index.ts`: 1
- `rehearsal-calendar-native/src/navigation/index.tsx`: 411
- `rehearsal-calendar-native/src/navigation/stacks.tsx`: 99
- `rehearsal-calendar-native/src/navigation/types.ts`: 49
- `rehearsal-calendar-native/src/shared/types/calendar.ts`: 87
- `rehearsal-calendar-native/src/shared/types/index.ts`: 73
- `rehearsal-calendar-native/src/shared/constants/colors.ts`: 59
- `rehearsal-calendar-native/src/shared/constants/timezones.ts`: 113
- `rehearsal-calendar-native/src/shared/constants/typography.ts`: 21
- `rehearsal-calendar-native/src/shared/constants/spacing.ts`: 20
- `rehearsal-calendar-native/src/shared/utils/availability.ts`: 72
- `rehearsal-calendar-native/src/shared/utils/formatLastSync.ts`: 20
- `rehearsal-calendar-native/src/shared/utils/calendarMappings.ts`: 245
- `rehearsal-calendar-native/src/shared/utils/locale.ts`: 16
- `rehearsal-calendar-native/src/shared/utils/storage.ts`: 30
- `rehearsal-calendar-native/src/shared/utils/conflictDetection.ts`: 99
- `rehearsal-calendar-native/src/shared/utils/dataChanged.ts`: 37
- `rehearsal-calendar-native/src/shared/utils/logger.ts`: 43
- `rehearsal-calendar-native/src/shared/utils/calendarStorage.ts`: 339
- `rehearsal-calendar-native/src/shared/utils/haptics.ts`: 29
- `rehearsal-calendar-native/src/shared/utils/time.ts`: 222
- `rehearsal-calendar-native/src/shared/utils/__tests__/connectionCache.test.ts`: 169
- `rehearsal-calendar-native/src/shared/utils/__tests__/dataChanged.test.ts`: 61
- `rehearsal-calendar-native/src/shared/utils/__tests__/calendarStorageWrites.test.ts`: 73
- `rehearsal-calendar-native/src/shared/utils/__tests__/time.timezone.test.ts`: 190
- `rehearsal-calendar-native/src/shared/components/DateRangePicker.tsx`: 316
- `rehearsal-calendar-native/src/shared/components/CreateActionSheet.tsx`: 182
- `rehearsal-calendar-native/src/shared/components/BetaBanner.tsx`: 193
- `rehearsal-calendar-native/src/shared/components/index.ts`: 16
- `rehearsal-calendar-native/src/shared/components/PickerModal.tsx`: 158
- `rehearsal-calendar-native/src/shared/components/UserAvatar.tsx`: 74
- `rehearsal-calendar-native/src/shared/components/buttons/GoogleSignInButton.tsx`: 103
- `rehearsal-calendar-native/src/shared/components/buttons/index.ts`: 2
- `rehearsal-calendar-native/src/shared/components/buttons/GlassButton.tsx`: 115
- `rehearsal-calendar-native/src/shared/components/__tests__/DateRangePicker.test.tsx`: 341
- `rehearsal-calendar-native/src/shared/components/loaders/SkeletonLoader.tsx`: 94
- `rehearsal-calendar-native/src/shared/components/loaders/index.ts`: 1
- `rehearsal-calendar-native/src/shared/components/animations/index.ts`: 0
- `rehearsal-calendar-native/src/shared/hooks/useAutoCalendarSync.ts`: 384
- `rehearsal-calendar-native/src/shared/hooks/useNotifications.ts`: 222
- `rehearsal-calendar-native/src/shared/hooks/__tests__/syncCost.test.ts`: 113
- `rehearsal-calendar-native/src/shared/hooks/__tests__/useAutoCalendarSync.test.ts`: 312
- `rehearsal-calendar-native/src/shared/services/appleAuth.ts`: 77
- `rehearsal-calendar-native/src/shared/services/googleAuth.ts`: 71
- `rehearsal-calendar-native/src/shared/services/notifications.ts`: 162
- `rehearsal-calendar-native/src/shared/services/api.ts`: 429
- `rehearsal-calendar-native/src/shared/services/calendar/management.ts`: 55
- `rehearsal-calendar-native/src/shared/services/calendar/permissions.ts`: 35
- `rehearsal-calendar-native/src/shared/services/calendar/export.ts`: 574
- `rehearsal-calendar-native/src/shared/services/calendar/index.ts`: 42
- `rehearsal-calendar-native/src/shared/services/calendar/import.ts`: 531
- `rehearsal-calendar-native/src/shared/services/calendar/__tests__/exportFailures.test.ts`: 135
- `rehearsal-calendar-native/src/shared/services/calendar/__tests__/importScope.test.ts`: 300
- `rehearsal-calendar-native/src/shared/services/calendar/__tests__/exportMatching.test.ts`: 138
- `rehearsal-calendar-native/src/__tests__/availabilityValidation.test.ts`: 331
- `rehearsal-calendar-native/src/__tests__/setup.ts`: 32
- `rehearsal-calendar-native/src/__tests__/__mocks__/react-navigation-native.js`: 23
- `rehearsal-calendar-native/src/__tests__/__mocks__/expo-calendar.js`: 49
- `rehearsal-calendar-native/src/__tests__/__mocks__/async-storage.js`: 42
- `rehearsal-calendar-native/src/__tests__/__mocks__/expo-notifications.js`: 27
- `rehearsal-calendar-native/src/__tests__/__mocks__/expo-clipboard.js`: 9
- `rehearsal-calendar-native/src/__tests__/__mocks__/expo-vector-icons.js`: 68
- `rehearsal-calendar-native/src/__tests__/__mocks__/react-native-calendars.js`: 68
- `rehearsal-calendar-native/src/__tests__/__mocks__/expo-haptics.js`: 19
- `rehearsal-calendar-native/src/__tests__/__mocks__/expo-constants.js`: 22
- `rehearsal-calendar-native/src/__tests__/__mocks__/react-native.js`: 233
- `rehearsal-calendar-native/src/__tests__/__mocks__/expo-device.js`: 24
- `rehearsal-calendar-native/src/__tests__/__mocks__/expo-font.js`: 9
- `rehearsal-calendar-native/src/__tests__/integration/availabilityFlow.test.ts`: 468
- `rehearsal-calendar-native/src/__tests__/integration/authFlow.test.ts`: 304
- `rehearsal-calendar-native/src/__tests__/integration/rehearsalFlow.test.ts`: 399
- `rehearsal-calendar-native/src/__tests__/utils/testUtils.tsx`: 23
- `rehearsal-calendar-native/src/__tests__/utils/mockData.ts`: 72
- `rehearsal-calendar-native/src/hooks/useWeekStart.ts`: 71
- `rehearsal-calendar-native/src/i18n/translations.ts`: 95
- `rehearsal-calendar-native/src/i18n/__tests__/plurals.test.ts`: 56
- `rehearsal-calendar-native/src/i18n/translations/availability.ts`: 425
- `rehearsal-calendar-native/src/i18n/translations/projects.ts`: 382
- `rehearsal-calendar-native/src/i18n/translations/calendarSync.ts`: 602
- `rehearsal-calendar-native/src/i18n/translations/notifications.ts`: 93
- `rehearsal-calendar-native/src/i18n/translations/common.ts`: 342
- `rehearsal-calendar-native/src/i18n/translations/calendar.ts`: 464
- `rehearsal-calendar-native/src/i18n/translations/profile.ts`: 244
- `rehearsal-calendar-native/src/i18n/translations/onboarding.ts`: 257
- `rehearsal-calendar-native/src/i18n/translations/auth.ts`: 217
- `.vscode/settings.json`: 3
