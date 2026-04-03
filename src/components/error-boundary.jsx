import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Punchlist render error:', error, info?.componentStack);
  }

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
          <div style={{ fontSize: '2.5rem' }}>&#128296;</div>
          <h2 style={{ margin: 0, letterSpacing: '-0.03em' }}>Something went wrong</h2>
          <p style={{ color: 'var(--muted)', maxWidth: 400, lineHeight: 1.6, margin: 0 }}>
            Punchlist hit an unexpected error. Your data is safe.
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              className="btn btn-primary"
              type="button"
              onClick={() => window.location.href = '/app'} // Full reload intentional — React tree is in error state
            >
              Back to dashboard
            </button>
            <button
              className="btn btn-secondary"
              type="button"
              onClick={() => this.setState({ error: null })}
            >
              Try again
            </button>
          </div>
          {process.env.NODE_ENV === 'development' && (
            <pre style={{
              marginTop: 20,
              background: 'var(--red-bg)',
              color: 'var(--red)',
              padding: 16,
              borderRadius: 8,
              fontSize: 11,
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
