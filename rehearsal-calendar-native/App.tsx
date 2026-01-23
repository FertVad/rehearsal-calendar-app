import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from './src/contexts/AuthContext';
import { ProjectProvider } from './src/contexts/ProjectContext';
import { I18nProvider } from './src/contexts/I18nContext';
import Navigation from './src/navigation';
import { useAutoCalendarSync } from './src/shared/hooks/useAutoCalendarSync';
import { useNotifications } from './src/shared/hooks/useNotifications';

function AppContent() {
  // Enable automatic calendar sync on app foreground
  useAutoCalendarSync();

  // Enable push notifications
  useNotifications();

  return (
    <>
      <Navigation />
      <StatusBar style="light" />
    </>
  );
}

export default function App() {
  return (
    <I18nProvider>
      <AuthProvider>
        <ProjectProvider>
          <AppContent />
        </ProjectProvider>
      </AuthProvider>
    </I18nProvider>
  );
}
