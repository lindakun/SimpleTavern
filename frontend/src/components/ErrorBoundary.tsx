import { Component, type ErrorInfo, type ReactNode } from 'react';
import { useToast } from './Toast';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error Boundary - 捕获子组件渲染错误，防止整个应用崩溃
 *
 * 使用方式:
 * <ErrorBoundary>
 *   <MyComponent />
 * </ErrorBoundary>
 *
 * 或在 main.tsx 中包裹整个 App:
 * <ErrorBoundary>
 *   <ToastProvider>
 *     <App />
 *   </ToastProvider>
 * </ErrorBoundary>
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      // 自定义 fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // 默认错误 UI
      return <ErrorFallback error={this.state.error} onReset={this.handleReset} />;
    }

    return this.props.children;
  }
}

// 内部错误展示组件
function ErrorFallback({ error, onReset }: { error: Error | null; onReset: () => void }) {
  return (
    <div className="min-h-screen bg-[#090A0F] text-[#E0E0E6] flex items-center justify-center p-6">
      <div className="bg-surface-container/50 border border-red-500/30 rounded-2xl p-8 max-w-md w-full text-center space-y-4">
        <div className="text-4xl mb-2">⚠️</div>
        <h2 className="text-lg font-bold text-red-400">系统发生异常</h2>
        <p className="text-xs text-on-surface-variant">
          抱歉，页面遇到了意外错误。请尝试刷新或返回首页。
        </p>
        {error && (
          <details className="text-left">
            <summary className="text-[10px] text-on-surface-variant/60 cursor-pointer">
              技术详情
            </summary>
            <pre className="text-[10px] text-red-400/70 mt-2 p-2 bg-black/30 rounded overflow-auto max-h-32">
              {error.message}
            </pre>
          </details>
        )}
        <div className="flex gap-3 justify-center pt-2">
          <button
            onClick={onReset}
            className="px-4 py-2 bg-accent-pink/20 hover:bg-accent-pink/30 text-accent-pink rounded-lg text-xs font-medium transition-colors cursor-pointer"
          >
            重试
          </button>
          <a
            href="/"
            className="px-4 py-2 bg-surface-elevated hover:bg-surface-container text-white rounded-lg text-xs font-medium transition-colors"
          >
            返回首页
          </a>
        </div>
      </div>
    </div>
  );
}

// Hook 版本 - 用于函数组件中捕获异步错误
export function useErrorHandler() {
  const { showToast } = useToast();

  return (error: Error, context?: string) => {
    console.error(`[${context || 'Unknown'}] Error:`, error);
    showToast(`操作失败: ${error.message}`, 'error');
  };
}

export default ErrorBoundary;
