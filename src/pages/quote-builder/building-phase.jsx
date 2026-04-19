import { Card } from '../../components/ui';
import { useQuoteBuilder } from './quote-builder-context';
import { actions } from './use-quote-draft';
import { browseCatalog } from '../../../shared/systemCatalog';

/* ═══════════════════════════════════════════════════════════
   BuildingPhase — AI scope generation loading screen.

   Shows:
     • Animated progress bar (CSS-only, 0→85% over 15s)
     • Pulsing status messages
     • Trade-specific skeleton preview items
     • Back-to-edit escape hatch
   ═══════════════════════════════════════════════════════════ */

export default function BuildingPhase() {
  const { state, dispatch } = useQuoteBuilder();
  const { trade, description, scopeLoadingMsg, photoSaved } = state;

  const previewItems = browseCatalog(trade, 5).slice(0, 4).map(h => h.n);

  return (
    <Card padding="loose" className="pl-building-stable" elevation={1}>
      {/* CSS-only top progress bar 0→85% over 15s */}
      <div className="qb-build-progress" aria-hidden="true" />

      <div className="bs-loading qb-building-body">
        <div className="bs-ai-status">
          <div className="bs-ai-dot" />
          AI is building your quote
        </div>
        <div className="loading-spinner qb-building-spinner" aria-hidden="true" />
        <div aria-live="polite" className="qb-building-msg">
          {scopeLoadingMsg}
        </div>
        <div className="qb-building-context">
          {trade} · {description.slice(0, 60)}{description.length > 60 ? '…' : ''}
        </div>
        {photoSaved && (
          <div className="jd-photo-saved qb-building-photo">
            ✓ Photo included
          </div>
        )}

        {/* Skeleton preview items */}
        <div className="bs-skeleton-list qb-skeleton-list">
          {previewItems.map((name, i) => (
            <div
              key={`sk-${name}-${i}`}
              className="bs-skeleton-item"
              style={{ animationDelay: `${i * 0.15}s` }}
            >
              <div className="bs-skeleton-check" />
              <div className="bs-skeleton-text">
                <div
                  className="bs-skeleton-bar"
                  style={{ width: `${Math.min(85, name.length * 3.5 + 20)}%` }}
                />
              </div>
              <div className="bs-skeleton-bar price" />
            </div>
          ))}
        </div>

        <button
          type="button"
          className="qb-building-back"
          onClick={() => {
            dispatch(actions.setScopeLoading(false));
            dispatch(actions.setPhase('describe'));
          }}
        >
          ← Back to edit
        </button>
      </div>
    </Card>
  );
}
