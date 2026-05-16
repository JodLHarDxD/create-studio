import { WorkspaceProvider } from './contexts/WorkspaceContext';
import Shell from './components/layout/Shell';

export default function App() {
  return (
    <WorkspaceProvider>
      <Shell />
    </WorkspaceProvider>
  );
}
