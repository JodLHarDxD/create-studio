import { WorkspaceProvider } from './contexts/WorkspaceContext';
import Shell from './components/layout/Shell';
import { ToastProvider } from './components/ui/Toast';

export default function App() {
  return (
    <WorkspaceProvider>
      <ToastProvider>
        <Shell />
      </ToastProvider>
    </WorkspaceProvider>
  );
}
