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
        <div className="fixed inset-0 bg-black flex items-center justify-center p-8">
          <div className="max-w-lg w-full border border-red-500/30 bg-red-500/5 p-8 space-y-4">
            <div className="text-[9px] font-black uppercase tracking-[0.3em] text-red-400">
              Runtime Error
            </div>
            <div className="text-[11px] font-mono text-red-300">
              {this.state.error.message}
            </div>
            <div className="text-[9px] text-white/30 font-mono whitespace-pre-wrap leading-relaxed">
              {this.state.error.stack?.split('\n').slice(1, 5).join('\n')}
            </div>
            <button
              onClick={() => this.setState({ error: null })}
              className="mt-4 border border-white/20 px-4 py-2 text-[9px] font-black uppercase tracking-widest hover:bg-white/5 transition-colors"
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
