import React from 'react';

interface State {
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="fixed inset-0 bg-[#F4EFE6] flex items-center justify-center p-8">
          <div className="max-w-lg w-full border border-[#B53C2A]/30 bg-[#B53C2A]/06 p-8 space-y-4">
            <div className="text-[9px] font-black uppercase tracking-[0.3em] text-[#B53C2A]">
              Runtime Error
            </div>
            <div className="text-[11px] font-mono text-[#B53C2A]">
              {this.state.error.message}
            </div>
            <div className="text-[9px] text-[#9B948A] font-mono whitespace-pre-wrap leading-relaxed">
              {this.state.error.stack?.split('\n').slice(1, 5).join('\n')}
            </div>
            <button
              onClick={() => this.setState({ error: null })}
              className="mt-4 border border-[rgba(26,22,18,0.18)] px-4 py-2 text-[9px] font-black uppercase tracking-widest hover:bg-[rgba(26,22,18,0.05)] transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
