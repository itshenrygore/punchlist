import { useState } from 'react';
import { currency } from '../lib/format';

/**
 * SuggestionSection — shared UI for Helper Draft + Check Scope
 * Both systems return the same item shape and use this component.
 */

const CONF_STYLE = {
  high:   { label: 'High',   color: '#15803d', bg: 'rgba(21,128,61,.12)' },
  medium: { label: 'Med',    color: '#b07030', bg: 'rgba(176,112,48,.12)' },
  low:    { label: 'Low',    color: '#6b7280', bg: 'rgba(107,114,128,.12)' },
};

const SECTION_META = {
  core_scope:      { icon: '⚡', label: 'Core Scope',           tone: 'primary' },
  materials:       { icon: '🔩', label: 'Materials',            tone: 'neutral' },
  often_included:  { icon: '📋', label: 'Often Included',       tone: 'neutral' },
  confirm:         { icon: '❓', label: 'Confirm Before Sending', tone: 'warn'   },
  upgrades:        { icon: '⭐', label: 'Upgrade Options',       tone: 'upgrade' },
  likely_missing:  { icon: '⚠',  label: 'Likely Missing',        tone: 'miss'   },
  upgrade:         { icon: '⭐', label: 'Upgrade Opportunities', tone: 'upgrade' },
};

/** Single suggestion item row */
export function SuggestionItem({ item, onAdd, onSkip, isAdded, isSkipped, actionLabel = 'Add' }) {
  const [showWhy, setShowWhy] = useState(false);
  const conf = CONF_STYLE[item.conf || item.confidence] || CONF_STYLE.medium;

  if (isSkipped) return null;

  return (
    <div className={`sg-item ${isAdded ? 'sg-item--added' : ''}`}>
      <div className="sg-item-body">
        <div className="sg-item-top">
          <div className="sg-item-name">{item.name || item.line_item}</div>
          <div className="sg-item-price">
            {item.lo > 0 && item.hi > 0
              ? `${currency(item.lo)}–${currency(item.hi)}`
              : item.unit_price > 0 ? currency(item.unit_price) : ''}
          </div>
        </div>
        {showWhy && (item.reason || item.why) && (
          <div className="sg-item-why">{item.reason || item.why}</div>
        )}
      </div>
      <div className="sg-item-actions">
        {!isAdded ? (
          <>
            <button type="button" className="sg-btn-add" onClick={() => onAdd?.(item)}>
              {actionLabel}
            </button>
            {(item.reason || item.why) && (
              <button type="button" className="sg-btn-why" onClick={() => setShowWhy(v => !v)}>
                {showWhy ? '✕' : 'Why'}
              </button>
            )}
            <button type="button" className="sg-btn-skip" onClick={() => onSkip?.(item)}>Skip</button>
          </>
        ) : (
          <span className="sg-added-badge">✓ Added</span>
        )}
      </div>
      {!isAdded && (
        <div className="sg-item-meta">
          <span className="sg-conf" style={{ background: conf.bg, color: conf.color }}>{conf.label}</span>
          {(item.type || item.item_type) && (
            <span className="sg-type">{item.type || item.item_type}</span>
          )}
        </div>
      )}
    </div>
  );
}

/** Full section with title + items */
export function SuggestionSection({ type, title, items = [], onAdd, onSkip, addedNames, skippedNames, actionLabel }) {
  const [collapsed, setCollapsed] = useState(false);
  const meta = SECTION_META[type] || { icon: '•', label: title, tone: 'neutral' };
  const visible = items.filter(i => !(skippedNames?.has(i.name || i.line_item)));
  if (!visible.length) return null;

  const pending = visible.filter(i => !(addedNames?.has(i.name || i.line_item)));

  return (
    <div className={`sg-section sg-section--${meta.tone}`}>
      <button
        type="button"
        className="sg-section-head"
        onClick={() => setCollapsed(v => !v)}
      >
        <span className="sg-section-icon">{meta.icon}</span>
        <span className="sg-section-title">{meta.label || title}</span>
        <span className="sg-section-count">{pending.length}</span>
        <span className="sg-section-chevron">{collapsed ? '›' : '⌄'}</span>
      </button>
      {!collapsed && (
        <div className="sg-section-items">
          {items.map(item => (
            <SuggestionItem
              key={item.name || item.line_item || item.id}
              item={item}
              onAdd={onAdd}
              onSkip={onSkip}
              isAdded={addedNames?.has(item.name || item.line_item)}
              isSkipped={skippedNames?.has(item.name || item.line_item)}
              actionLabel={actionLabel || (type === 'confirm' ? 'Add if needed' : type === 'upgrades' || type === 'upgrade' ? 'Add upgrade' : 'Add')}
            />
          ))}
        </div>
      )}
    </div>
  );
}
