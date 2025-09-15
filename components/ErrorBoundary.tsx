import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(_: Error): State {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    // You could also log the error to an external service here
  }
  
  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-screen w-screen bg-slate-100 text-slate-800 font-sans">
            <div className="text-center p-8 bg-white rounded-lg shadow-lg border border-slate-200 max-w-md">
                <h1 className="text-2xl font-bold text-red-600 mb-2">Đã xảy ra lỗi</h1>
                <p className="text-slate-600 mb-4">
                    Rất tiếc, ứng dụng đã gặp sự cố không mong muốn. Dữ liệu của bạn đã được lưu tự động.
                </p>
                <p className="text-slate-600 mb-6">
                    Vui lòng tải lại trang để tiếp tục.
                </p>
                <button 
                    onClick={this.handleReload}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-6 rounded-md transition-colors"
                >
                    Tải lại ứng dụng
                </button>
            </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
