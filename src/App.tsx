import { WorkspaceProvider } from './contexts/WorkspaceContext';
import Shell from './components/layout/Shell';
import { ToastProvider } from './components/ui/Toast';
import ErrorBoundary from './components/ui/ErrorBoundary';

export default function App() {
  return (
    <ErrorBoundary>
      <WorkspaceProvider>
        <ToastProvider>
          <ErrorBoundary>
            <Shell />
          </ErrorBoundary>
        </ToastProvider>
      </WorkspaceProvider>
    </ErrorBoundary>
  );
}
