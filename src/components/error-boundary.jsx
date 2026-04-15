import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null, isChunkError: false };
  }

  static getDerivedStateFromError(error) {
    const isChunkError = error?.name === 'ChunkLoadError' ||
      error?.message?.includes('Loading chunk') ||
      error?.message?.includes('Failed to fetch dynamically imported module') ||
      error?.message?.includes('Importing a module script failed');
    return { error, isChunkError };
  }

  componentDidCatch(error, info) {
    console.error('Punchlist render error:', error, info?.componentStack);
  }

  handleRetry = () => {
    if (this.state.isChunkError) {
      window.location.reload();
    } else {
      this.setState({ error: null, isChunkError: false });
    }
  };

  render() {
    if (this.state.error) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          textAlign: 'center',
          padding: 24,
          fontFamily: 'Inter, -apple-system, sans-serif',
          color: 'var(--text)',
        }}>
          <div style={{ fontSize: '2.5rem' }}>{this.state.isChunkError ? '📡' : '🔨'}</div>
          <h2 style={{ margin: 0, letterSpacing: '-0.03em' }}>
            {this.state.isChunkError ? 'Connection issue' : 'Something went wrong'}
          </h2>
          <p style={{ color: 'var(--muted)', maxWidth: 400, lineHeight: 1.6, margin: 0 }}>
            {this.state.isChunkError
              ? 'A page failed to load — this usually means a spotty connection. Tap below to try again.'
              : 'Punchlist hit an unexpected error. Your data is safe.'}
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              className="btn btn-primary"
              type="button"
              onClick={this.handleRetry}
            >
              {this.state.isChunkError ? 'Reload page' : 'Try again'}
            </button>
            {!this.state.isChunkError && (
              <button
                className="btn btn-secondary"
                type="button"
                onClick={() => window.location.href = '/app'}
              >
                Back to dashboard
              </button>
            )}
          </div>
          {process.env.NODE_ENV === 'development' && !this.state.isChunkError && (
            <pre style={{
              marginTop: 20,
              background: 'var(--red-bg)',
              color: 'var(--red)',
              padding: 16,
              borderRadius: 8,
              fontSize: 'var(--text-2xs)',
              textAlign: 'left',
              maxWidth: 600,
              overflow: 'auto',
              whiteSpace: 'pre-wrap',
              border: '1px solid rgba(192,64,64,.2)',
            }}>
              {this.state.error?.message}
            </pre>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}
