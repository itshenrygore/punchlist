import { Component } from 'react';

/**
 * ErrorBoundary
 *
 * Catches render errors in its subtree.
 *
 * Key design choices:
 *  • `resetKey` prop — when this value changes between renders, the boundary
 *    automatically clears its error state. Pass the current pathname so that
 *    navigating away from a broken page recovers the UI without a full
 *    page reload (previously the entire app shell was replaced by the error
 *    UI, leaving the user with no way to get out except a hard reload).
 *  • "Try again" first attempts a soft reset; if the same page crashes
 *    twice in a row we fall back to a hard reload so the user isn't stuck
 *    in a re-render loop.
 *  • Chunk-load errors always hard-reload — those mean the deployed JS
 *    bundle changed underneath the user.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null, isChunkError: false, retryCount: 0 };
  }

  static getDerivedStateFromError(error) {
    const isChunkError = error?.name === 'ChunkLoadError' ||
      error?.message?.includes('Loading chunk') ||
      error?.message?.includes('Failed to fetch dynamically imported module') ||
      error?.message?.includes('Importing a module script failed');
    return { error, isChunkError };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('Punchlist render error:', error, info?.componentStack);
  }

  componentDidUpdate(prevProps) {
    // Auto-reset when the resetKey changes (e.g. user navigated to a new
    // route via the bottom nav / sidebar / browser back).
    if (
      this.state.error &&
      prevProps.resetKey !== this.props.resetKey
    ) {
      // eslint-disable-next-line react/no-did-update-set-state
      this.setState({ error: null, isChunkError: false, retryCount: 0 });
    }
  }

  handleRetry = () => {
    if (this.state.isChunkError) {
      window.location.reload();
      return;
    }
    // If the user already retried once and still hits the same error, a soft
    // reset will likely just crash again — do a hard reload instead.
    if (this.state.retryCount >= 1) {
      window.location.reload();
      return;
    }
    this.setState(s => ({ error: null, isChunkError: false, retryCount: s.retryCount + 1 }));
  };

  handleHome = () => {
    window.location.href = '/app';
  };

  render() {
    if (this.state.error) {
      const isHardReloadNext = this.state.isChunkError || this.state.retryCount >= 1;
      return (
        <div style={{
          minHeight: '60vh',
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
              : 'Punchlist hit an unexpected error. Your data is safe — tap below, or use the menu to head somewhere else.'}
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              className="btn btn-primary"
              type="button"
              onClick={this.handleRetry}
            >
              {isHardReloadNext ? 'Reload page' : 'Try again'}
            </button>
            {!this.state.isChunkError && (
              <button
                className="btn btn-secondary"
                type="button"
                onClick={this.handleHome}
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
