// Must be the first import: gesture-handler asks to be set up before anything
// it will be handling is rendered.
import 'react-native-gesture-handler';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from './src/contexts/AuthContext';
import { ProjectProvider } from './src/contexts/ProjectContext';
import { I18nProvider } from './src/contexts/I18nContext';
import { SeenProvider } from './src/contexts/SeenContext';
import { UnreadProvider } from './src/contexts/UnreadContext';
import Navigation from './src/navigation';
import { useAutoCalendarSync } from './src/shared/hooks/useAutoCalendarSync';
import { useUsageDays } from './src/shared/hooks/useUsageDays';
import { registerInstall } from './src/shared/services/attribution';

// Once per launch, before anything is drawn: for Apple's install postback to an
// ad network whose ad led here (T-424). Never throws; a failure is logged.
void registerInstall();

function AppContent() {
  // Enable automatic calendar sync on app foreground
  useAutoCalendarSync();
  // The days of use, on this phone only, for when to ask for a rating (T-410).
  useUsageDays();

  // Note: Push notifications are handled inside Navigation component
  // after NavigationContainer is ready

  return (
    <>
      <Navigation />
      <StatusBar style="light" />
    </>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <I18nProvider>
        <AuthProvider>
          <ProjectProvider>
            <SeenProvider>
              <UnreadProvider>
                <AppContent />
              </UnreadProvider>
            </SeenProvider>
          </ProjectProvider>
        </AuthProvider>
      </I18nProvider>
    </GestureHandlerRootView>
  );
}
