import { Component } from 'react';

export default class ErrorBoundary extends Component {
 constructor(props) {
 super(props);
 this.state = { error: null, isChunkError: false, componentStack: '', showDetails: false };
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
 this.setState({ error: null, isChunkError: false, componentStack: '', showDetails: false });
 }
 };

 render() {
 if (this.state.error) {
 return (
 <div className="eb-flex_ta-center-30e2">
 <div className="eb-s2-3ba5">{this.state.isChunkError ? '📡' : '🔨'}</div>
 <h2 className="eb-s1-dbf8">
 {this.state.isChunkError ? 'Connection issue' : 'Something went wrong'}
 </h2>
 <p className="eb-s0-8176">
 {this.state.isChunkError
 ? 'A page failed to load — this usually means a spotty connection. Tap below to try again.'
 : 'Punchlist hit an unexpected error. Your data is safe.'}
 </p>
 <div className="eb-flex-fc81">
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
 {import.meta.env.DEV && !this.state.isChunkError && (
 <>
 <button
 type="button"
 onClick={() => this.setState(s => ({ showDetails: !s.showDetails }))}
 className="eb-fs-xs-ebda">
 {this.state.showDetails ? 'Hide error details' : 'Show error details'}
 </button>
 {this.state.showDetails && (
 <pre className="eb-ta-left-b93f">
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
