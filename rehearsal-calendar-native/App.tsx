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

function AppContent() {
  // Enable automatic calendar sync on app foreground
  useAutoCalendarSync();

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
