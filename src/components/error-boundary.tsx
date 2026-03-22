import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-[100vh] h-[100dvh] bg-[var(--way-void)] flex items-center justify-center p-6">
          <div className="text-center">
            <div className="text-[var(--way-ash)] text-sm mb-4">Произошла ошибка</div>
            <button
              onClick={() => window.location.reload()}
              className="text-[var(--way-gold)] border border-[rgba(200,180,140,0.2)] px-4 py-2 rounded-lg text-sm"
            >
              Перезагрузить
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
