# Rehearsal Calendar - Mobile App

> 🎭 Приложение для планирования театральных репетиций с умными рекомендациями времени

[![React Native](https://img.shields.io/badge/React%20Native-0.81.5-61DAFB?logo=react)](https://reactnative.dev/)
[![Expo](https://img.shields.io/badge/Expo-54-000020?logo=expo)](https://expo.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9.2-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18.0.0-339933?logo=node.js)](https://nodejs.org/)

## 📱 Features

- ✅ **Authentication:** Email/Password + Telegram login
- ✅ **Multi-project management:** Create and join multiple projects
- ✅ **Rehearsal scheduling:** Create rehearsals with conflict detection
- ✅ **Availability management:** Set your available/busy time slots
- ✅ **RSVP system:** Confirm or decline rehearsal invitations
- ✅ **Smart recommendations:** AI-powered time suggestions based on team availability
- ✅ **Invite links:** Easy project sharing via deep links
- ✅ **Internationalization:** English & Russian support

## 🚀 Quick Start

### Prerequisites
- Node.js >= 18.0.0
- npm or yarn
- Xcode (for iOS development)
- PostgreSQL or SQLite

### Installation

```bash
# 1. Clone repository
git clone <repo-url>
cd rehearsal-calendar-native

# 2. Install dependencies
npm install
cd server && npm install && cd ..

# 3. Setup environment
cp server/.env.example server/.env
# Edit server/.env with your configuration

# 4. Initialize database
cd server && npm run migrate:dev && cd ..
```

### Running the App

```bash
# Terminal 1: Start backend server
cd server && node server.js

# Terminal 2: Start Metro bundler
npx expo start -c

# Terminal 3: Run iOS (via Xcode)
open ios/rehearsalcalendarnative.xcworkspace
# In Xcode: Product → Run (⌘R)
```

## 📚 Documentation

- **[PROJECT_INFO.md](./PROJECT_INFO.md)** - Complete project documentation
  - Tech stack details
  - Database schema
  - API endpoints
  - Architecture overview

- **[CLEANUP_RECOMMENDATIONS.md](./CLEANUP_RECOMMENDATIONS.md)** - Code cleanup guide
  - Dead code analysis
  - Files to remove
  - Optimization tips

## 🏗 Tech Stack

**Frontend:**
- React Native 0.81.5
- Expo SDK 54
- TypeScript 5.9.2
- React Navigation 7
- Axios for HTTP
- i18next for i18n

**Backend:**
- Node.js + Express.js
- PostgreSQL (production)
- SQLite (development)
- JWT authentication
- bcrypt for passwords

## 📂 Project Structure

```
rehearsal-calendar-native/
├── src/                          # React Native app
│   ├── features/                 # Feature modules
│   │   ├── auth/                 # Authentication
│   │   ├── calendar/             # Calendar & rehearsals
│   │   ├── projects/             # Project management
│   │   ├── profile/              # User profile
│   │   └── availability/         # Availability management
│   ├── navigation/               # Navigation setup
│   ├── contexts/                 # React contexts
│   ├── shared/                   # Shared utilities
│   │   ├── components/           # Reusable components
│   │   ├── constants/            # Design tokens
│   │   ├── services/             # API client
│   │   └── utils/                # Helper functions
│   └── i18n/                     # Translations
│
├── server/                       # Backend server
│   ├── routes/                   # API routes
│   ├── database/                 # DB layer & migrations
│   ├── middleware/               # Express middleware
│   └── server.js                 # Entry point
│
├── ios/                          # iOS native code
└── android/                      # Android (not configured)
```

## 🔧 Common Commands

```bash
# Development
npx expo start -c              # Clear cache and start Metro
npm run ios                    # Run on iOS simulator
npm run android                # Run on Android emulator

# Type checking
npx tsc --noEmit               # Check TypeScript errors

# Database
cd server
npm run migrate:dev            # Run migrations (SQLite)
npm run migrate:neon           # Run migrations (PostgreSQL)

# Clean build (iOS)
cd ios
rm -rf build Pods Podfile.lock
pod install
```

## 🎨 Design System

### Color Palette
```typescript
Colors.bg.primary      // #0A0A0F (Dark background)
Colors.bg.secondary    // #16161F (Card background)
Colors.accent.purple   // #A855F7 (Primary brand)
Colors.accent.blue     // #3B82F6
Colors.accent.green    // #10B981
Colors.text.primary    // #FFFFFF
Colors.text.secondary  // #A1A1AA
```

### Components
- **GlassButton** - Button with glass morphism effect
- **Card** - Container with glass background
- **Section** - Content section wrapper
- **LoadingSpinner** - Loading indicator
- **ErrorState** - Error display component

## 🌐 API Configuration

Development:
```typescript
// src/shared/services/api.ts
const API_URL = 'http://192.168.1.39:3001/api';
```

Production:
```typescript
const API_URL = 'https://your-domain.com/api';
```

## 🗺 Roadmap

### ✅ Completed
- [x] Authentication system
- [x] Project management
- [x] Rehearsal CRUD
- [x] Availability management
- [x] RSVP system
- [x] Smart time recommendations
- [x] Invite links
- [x] Internationalization

### 🔜 Upcoming
- [ ] Push notifications
- [ ] Offline mode
- [ ] Calendar export (iCal)
- [ ] Multi-timezone support
- [ ] Analytics integration
- [ ] Android configuration

## 🐛 Known Issues

- TypeScript errors in availability utils (non-blocking)
- Android not configured yet (iOS only)

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## 📄 License

MIT License - See LICENSE file for details

## 📞 Support

- **Issues:** GitHub Issues
- **Documentation:** [PROJECT_INFO.md](./PROJECT_INFO.md)
- **Email:** your-email@example.com

---

**Version:** 1.0.0
**Last Updated:** December 3, 2024
**Author:** Vadim Fertik
