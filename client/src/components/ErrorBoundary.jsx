import React from 'react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error("Uncaught error:", error, errorInfo);
    }

    handleReset = () => {
        localStorage.removeItem('uc_roomId');
        localStorage.removeItem('uc_getName');
        window.location.reload();
    };

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-4 text-center">
                    <h1 className="text-4xl font-bold mb-4 text-red-500">Something went wrong.</h1>
                    <p className="mb-8 text-gray-400 max-w-md">
                        The game encountered an unexpected error. Don't worry, you can reset to fix it.
                    </p>
                    <div className="bg-slate-800 p-4 rounded-lg mb-8 text-left text-xs text-red-300 font-mono w-full max-w-lg overflow-auto">
                        {this.state.error?.toString()}
                    </div>
                    <button
                        onClick={this.handleReset}
                        className="bg-primary hover:bg-violet-600 text-white font-bold py-3 px-8 rounded-full transition-all shadow-lg hover:scale-105"
                    >
                        🔄 RESET GAME
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
