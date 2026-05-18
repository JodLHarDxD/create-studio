import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ToastProvider, useToast } from './Toast';

function ToastHarness() {
  const { toast } = useToast();

  return (
    <div>
      <button onClick={() => toast({ title: 'Saved', description: 'Project synced', tone: 'success' })}>
        Push success
      </button>
      <button onClick={() => toast({ title: 'Short lived', duration: 1 })}>
        Push short
      </button>
      <button
        onClick={() => {
          for (let i = 1; i <= 5; i += 1) {
            toast({ title: `Toast ${i}`, duration: 10_000 });
          }
        }}
      >
        Push queue
      </button>
    </div>
  );
}

function renderToasts() {
  return render(
    <ToastProvider>
      <ToastHarness />
    </ToastProvider>,
  );
}

describe('ToastProvider', () => {
  it('renders toast content published through the hook', () => {
    renderToasts();

    fireEvent.click(screen.getByRole('button', { name: 'Push success' }));

    expect(screen.getByText('Saved')).toBeInTheDocument();
    expect(screen.getByText('Project synced')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveAttribute('data-tone', 'success');
  });

  it('queues extra toasts and promotes the next item when one is dismissed', async () => {
    renderToasts();

    fireEvent.click(screen.getByRole('button', { name: 'Push queue' }));

    expect(screen.getByText('Toast 1')).toBeInTheDocument();
    expect(screen.getByText('Toast 2')).toBeInTheDocument();
    expect(screen.getByText('Toast 3')).toBeInTheDocument();
    expect(screen.queryByText('Toast 4')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss Toast 1' }));

    await waitFor(() => {
      expect(screen.queryByText('Toast 1')).not.toBeInTheDocument();
      expect(screen.getByText('Toast 4')).toBeInTheDocument();
    });
  });

  it('auto-dismisses toasts after their duration', async () => {
    renderToasts();

    fireEvent.click(screen.getByRole('button', { name: 'Push short' }));
    expect(screen.getByText('Short lived')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.queryByText('Short lived')).not.toBeInTheDocument();
    });
  });
});
