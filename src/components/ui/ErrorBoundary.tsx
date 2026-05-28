import React from 'react';
import { AlertTriangle, RefreshCw, RotateCcw } from 'lucide-react';

interface Props {
  children: React.ReactNode;
  /** Optional label shown in the error UI to identify which section crashed */
  label?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    this.setState({ errorInfo: info });
    console.error('[ErrorBoundary] Uncaught error:', error, info);
  }

  recover = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const { error, errorInfo } = this.state;
    const { label } = this.props;

    return (
      <div className="flex flex-col items-center justify-center h-full w-full bg-[#09090b] text-[#e4e4e7] gap-6 p-8">
        {/* Icon */}
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
          <AlertTriangle className="w-8 h-8 text-red-500" />
        </div>

        {/* Message */}
        <div className="text-center max-w-lg">
          <h1 className="text-lg font-black text-white mb-1">
            {label ? `"${label}" crashed` : 'Something went wrong'}
          </h1>
          <p className="text-sm text-[#52525b] mb-4">
            An unexpected error occurred in this view. The rest of the app is unaffected.
          </p>

          {/* Error message */}
          {error?.message && (
            <div className="text-left bg-[#0c0c0e] border border-red-500/20 rounded-xl p-4 mb-3">
              <div className="text-[10px] font-bold uppercase tracking-widest text-red-500/70 mb-1.5">Error</div>
              <code className="text-xs font-mono text-red-300/80 break-all leading-relaxed">
                {error.message}
              </code>
            </div>
          )}

          {/* Stack trace (collapsed) */}
          {errorInfo?.componentStack && (
            <details className="text-left">
              <summary className="text-[10px] text-[#52525b] cursor-pointer hover:text-[#a1a1aa] transition-colors font-bold uppercase tracking-wider">
                Show component stack
              </summary>
              <pre className="mt-2 text-[9px] font-mono text-[#3f3f46] bg-[#0c0c0e] border border-[#27272a] rounded-xl p-3 overflow-auto max-h-40 leading-relaxed text-left whitespace-pre-wrap break-all">
                {errorInfo.componentStack}
              </pre>
            </details>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={this.recover}
            className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold rounded-xl transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Try to recover
          </button>
          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 px-4 py-2 bg-[#18181b] hover:bg-[#27272a] border border-[#27272a] text-[#a1a1aa] text-sm font-bold rounded-xl transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Reload app
          </button>
        </div>
      </div>
    );
  }
}
