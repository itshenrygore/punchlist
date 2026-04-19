import { useState } from 'react';
import { MessageSquare } from 'lucide-react';
import ConvAvatar from '../conv-avatar';
import { usePublicQuote } from './public-quote-context';

/* ═══════════════════════════════════════════════════════════
   ConversationThread — Phase 5 redesign.

   Changes:
     • Hidden when empty (was always visible, wasting space)
     • When messages exist, shows "{n} message(s)" as a
       tappable row that expands inline
     • Never takes vertical space when there's nothing to show
   ═══════════════════════════════════════════════════════════ */

export default function ConversationThread() {
  const { quote } = usePublicQuote();
  const thread = quote?.conversation_thread || [];
  const [expanded, setExpanded] = useState(false);

  // Hidden when empty
  if (!thread || thread.length === 0) return null;

  const contractorName = quote.contractor_company || quote.contractor_name || 'Contractor';
  const label = thread.length === 1
    ? `1 message from ${contractorName}`
    : `${thread.length} messages`;

  return (
    <div className="pqv-thread">
      {/* Collapsed: tappable summary row */}
      <button
        type="button"
        className="pqv-thread-toggle"
        onClick={() => setExpanded(p => !p)}
        aria-expanded={expanded}
      >
        <MessageSquare size={14} className="pqv-inline-icon" />
        <span className="pqv-thread-label">{label}</span>
        <span className={`pl-chevron ${expanded ? 'pl-chevron--open' : ''}`} />
      </button>

      {/* Expanded: full thread */}
      {expanded && (
        <div className="pq-conversation-body">
          {thread.map(entry => (
            <div key={entry.id} className={`pq-msg ${entry.role === 'contractor' ? 'pq-msg--right' : ''}`}>
              <div className={`pq-msg-avatar ${entry.role === 'contractor' ? 'pq-msg-avatar--contractor' : ''}`}>
                <ConvAvatar role={entry.role} name={entry.name} logoUrl={entry.contractor_logo} size={32} />
              </div>
              <div className="pqv-msg-body">
                <div className={`pq-msg-meta ${entry.role === 'contractor' ? 'pqv-msg-meta--right' : 'pqv-msg-meta--left'}`}>
                  <strong>{entry.name || (entry.role === 'customer' ? 'You' : 'Contractor')}</strong>
                  {' · '}{new Date(entry.timestamp).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </div>
                <div className={`pq-msg-bubble ${entry.role === 'contractor' ? 'pq-msg-bubble--contractor' : ''}`}>
                  {entry.text}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
