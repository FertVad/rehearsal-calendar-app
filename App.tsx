import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from './src/contexts/AuthContext';
import { ProjectProvider } from './src/contexts/ProjectContext';
import { I18nProvider } from './src/contexts/I18nContext';
import Navigation from './src/navigation';

export default function App() {
  return (
    <I18nProvider>
      <AuthProvider>
        <ProjectProvider>
          <Navigation />
          <StatusBar style="light" />
        </ProjectProvider>
      </AuthProvider>
    </I18nProvider>
  );
}
