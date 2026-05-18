import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null, isChunkError: false, componentStack: '', showDetails: false, copied: false };
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
    this.setState({ componentStack: info?.componentStack || '' });
  }

  handleRetry = () => {
    if (this.state.isChunkError) {
      window.location.reload();
    } else {
      this.setState({ error: null, isChunkError: false, componentStack: '', showDetails: false, copied: false });
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
          {!this.state.isChunkError && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                const details = `${this.state.error?.name}: ${this.state.error?.message}\n${this.state.error?.stack || ''}\n${this.state.componentStack || ''}`;
                navigator.clipboard?.writeText(details).then(() => {
                  this.setState({ copied: true });
                  setTimeout(() => this.setState({ copied: false }), 2000);
                });
              }}
            >
              {this.state.copied ? '✓ Copied' : 'Copy error details'}
            </button>
          )}
          {import.meta.env.DEV && !this.state.isChunkError && (
            <>
              <button
                type="button"
                onClick={() => this.setState(s => ({ showDetails: !s.showDetails }))}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--muted)',
                  fontSize: 'var(--text-xs)',
                  textDecoration: 'underline',
                  cursor: 'pointer',
                  marginTop: 8,
                  fontFamily: 'inherit',
                }}
              >
                {this.state.showDetails ? 'Hide error details' : 'Show error details'}
              </button>
              {this.state.showDetails && (
                <pre style={{
                  marginTop: 8,
                  background: 'var(--red-bg, #fef2f2)',
                  color: 'var(--red, #b91c1c)',
                  padding: 16,
                  borderRadius: 8,
                  fontSize: '11px',
                  textAlign: 'left',
                  maxWidth: 'min(600px, 92vw)',
                  maxHeight: 360,
                  overflow: 'auto',
                  whiteSpace: 'pre-wrap',
                  border: '1px solid rgba(192,64,64,.2)',
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                }}>
                  {this.state.error?.name && <strong>{this.state.error.name}: </strong>}
                  {this.state.error?.message || 'Unknown error'}
                  {this.state.error?.stack && '\n\n' + this.state.error.stack}
                  {this.state.componentStack && '\n\nComponent stack:' + this.state.componentStack}
                </pre>
              )}
            </>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}
