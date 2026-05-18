import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { WorkspaceProvider } from './contexts/WorkspaceContext';
import Shell from './components/layout/Shell';
import { ToastProvider } from './components/ui/Toast';
import ErrorBoundary from './components/ui/ErrorBoundary';
import Preloader from './components/effects/Preloader';

export default function App() {
  const [showPreloader, setShowPreloader] = useState(true);

  return (
    <ErrorBoundary>
      <WorkspaceProvider>
        <ToastProvider>
          <ErrorBoundary>
            <Shell />
          </ErrorBoundary>
        </ToastProvider>
      </WorkspaceProvider>

      <AnimatePresence>
        {showPreloader && (
          <motion.div
            key="preloader"
            className="fixed inset-0 z-[200]"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.9, ease: 'easeInOut' } }}
          >
            <Preloader onComplete={() => setShowPreloader(false)} />
          </motion.div>
        )}
      </AnimatePresence>
    </ErrorBoundary>
  );
}
