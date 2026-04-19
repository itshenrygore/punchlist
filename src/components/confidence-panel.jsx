/**
 * ConfidencePanel — used in quote-detail-page sidebar (read-only)
 */
export default function ConfidencePanel({ confidence }) {
 if (!confidence) return null;
 const { score, readiness, checks } = confidence;
 const readinessLabel = readiness==='ready' ? 'Ready to send' : readiness==='review' ? 'Review suggested' : 'Needs attention';
 const readinessColor = readiness==='ready' ? 'var(--green)' : reyebrow cpnl-s0-24e8s==='review' ? 'var(--amber)' : 'var(--red)';
 return (
 <div className="conf-panel">
 <div className="conf-panel-top">
 <div>
 <div className="eyebrow">Quote confidence</div>
 <div style={{ fontSize: 'var(--text-2xs)', color:readinessColor, fontWeight:700 }}>{readinessLabel}</div>
 </div>
 <div className={`conf-score-badge ${readiness}`}>{score}%</div>
 </div>
 <div className="conf-checks">
 {(checks||[]).map((c,i) => (
 <div key={i} className={`conf-check ${c.state}`}>
 <span>{c.state==='good'?'✓':'⚠'}</span><span>{c.label}</span>
 </div>
 ))}
 </div>
 </div>
 );
}
