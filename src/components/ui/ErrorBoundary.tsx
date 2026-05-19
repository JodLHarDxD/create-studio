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
        <div className="fixed inset-0 bg-zinc-950 flex items-center justify-center p-8">
          <div className="max-w-lg w-full border border-red-400/30 bg-red-500/[0.06] p-8 space-y-4 backdrop-blur-xl">
            <div className="font-mono text-[10px] uppercase tracking-[0.30em] text-red-400 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
              Runtime Error
            </div>
            <div className="text-[12px] font-mono text-red-300 leading-relaxed">
              {this.state.error.message}
            </div>
            <div className="text-[10px] text-zinc-500 font-mono whitespace-pre-wrap leading-relaxed">
              {this.state.error.stack?.split('\n').slice(1, 5).join('\n')}
            </div>
            <button
              onClick={() => this.setState({ error: null })}
              className="mt-4 border border-white/[0.18] px-4 py-2 text-[10px] font-mono uppercase tracking-[0.25em] text-zinc-200 hover:border-emerald-400/40 hover:text-emerald-300 transition-colors"
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
