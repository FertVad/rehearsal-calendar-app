import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from './src/contexts/AuthContext';
import { ProjectProvider } from './src/contexts/ProjectContext';
import Navigation from './src/navigation';

export default function App() {
  return (
    <AuthProvider>
      <ProjectProvider>
        <Navigation />
        <StatusBar style="light" />
      </ProjectProvider>
    </AuthProvider>
  );
}
