import { useState, useRef, useEffect, useMemo } from 'react';
import { UserPlus, X, Phone, BookUser } from 'lucide-react';

/**
 * CustomerPicker — Search, select, or quick-create a customer
 *
 * Designed to be the FIRST thing a contractor interacts with
 * after the AI starts generating items. Recent customers show
 * at the top for one-tap selection.
 *
 * Props:
 *   customers — full customer list
 *   selectedId — currently selected customer ID
 *   onSelect(customer) — called when a customer is picked
 *   onCreate(data) — called to create a new customer
 *   loading — customers still loading
 */
export default function CustomerPicker({
  customers = [],
  selectedId,
  onSelect,
  onCreate,
  loading = false,
}) {
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newCust, setNewCust] = useState({ name: '', phone: '', email: '' });
  const [creating, setCreating] = useState(false);
  const inputRef = useRef(null);

  const selected = useMemo(
    () => customers.find(c => c.id === selectedId) || null,
    [customers, selectedId]
  );

  // Recent customers — last 5 unique, most recently used
  const recent = useMemo(() => {
    return [...customers]
      .sort((a, b) => new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0))
      .slice(0, 5);
  }, [customers]);

  // Filtered by search
  const filtered = useMemo(() => {
    if (!search.trim()) return recent;
    const q = search.toLowerCase();
    return customers
      .filter(c =>
        (c.name || '').toLowerCase().includes(q) ||
        (c.phone || '').includes(q) ||
        (c.email || '').toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [customers, search, recent]);

  const hasContactPicker = typeof navigator !== 'undefined' && 'contacts' in navigator && 'ContactsManager' in window;

  async function handlePickContact() {
    try {
      const props = ['name', 'tel', 'email'];
      const contacts = await navigator.contacts.select(props, { multiple: false });
      if (!contacts?.length) return;
      const c = contacts[0];
      const name = c.name?.[0] || '';
      const phone = c.tel?.[0] || '';
      const email = c.email?.[0] || '';
      if (!name && !phone) return;
      setNewCust({ name, phone, email });
      setShowCreate(true);
    } catch { /* user cancelled or API unavailable */ }
  }

  async function handleCreate() {
    if (!newCust.name.trim() && !newCust.phone.trim()) return;
    setCreating(true);
    try {
      await onCreate({
        name: newCust.name.trim(),
        phone: newCust.phone.trim(),
        email: newCust.email.trim(),
      });
      setNewCust({ name: '', phone: '', email: '' });
      setShowCreate(false);
    } catch { /* parent handles error */ }
    finally { setCreating(false); }
  }

  // If already selected, show compact chip
  if (selected) {
    return (
      <div className="cp-selected">
        <div className="cp-selected-info">
          <span className="cp-selected-name">{selected.name || 'Customer'}</span>
          {selected.phone && <span className="cp-selected-phone">{selected.phone}</span>}
        </div>
        <button
          type="button"
          className="cp-change-btn"
          onClick={() => onSelect(null)}
          aria-label="Change customer"
        >
          Change
        </button>
      </div>
    );
  }

  return (
    <div className="cp-picker">
      {/* Search input */}
      <div className="cp-search-row">
        <input
          ref={inputRef}
          className="cp-search-input"
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Customer name or phone"
          autoComplete="off"
        />
        {hasContactPicker && (
          <button type="button" className="cp-add-btn" onClick={handlePickContact} aria-label="Import from phone contacts">
            <BookUser size={16} />
          </button>
        )}
        <button
          type="button"
          className="cp-add-btn"
          onClick={() => setShowCreate(true)}
          aria-label="Add new customer"
        >
          <UserPlus size={16} />
        </button>
      </div>

      {/* Quick-create form */}
      {showCreate && (
        <div className="cp-create">
          <div className="cp-create-header">
            <span className="cp-create-title">New customer</span>
            <button type="button" className="cp-create-close" onClick={() => setShowCreate(false)} aria-label="Cancel">
              <X size={14} />
            </button>
          </div>
          <input
            className="cp-create-input"
            type="text"
            placeholder="Name"
            value={newCust.name}
            onChange={e => setNewCust(p => ({ ...p, name: e.target.value }))}
            autoFocus
          />
          <input
            className="cp-create-input"
            type="tel"
            placeholder="Phone (for texting the quote)"
            value={newCust.phone}
            onChange={e => setNewCust(p => ({ ...p, phone: e.target.value }))}
            inputMode="tel"
          />
          <input
            className="cp-create-input"
            type="email"
            placeholder="Email (optional)"
            value={newCust.email}
            onChange={e => setNewCust(p => ({ ...p, email: e.target.value }))}
          />
          <button
            type="button"
            className="btn btn-primary btn-sm full-width"
            onClick={handleCreate}
            disabled={creating || (!newCust.name.trim() && !newCust.phone.trim())}
          >
            {creating ? 'Adding…' : 'Add customer'}
          </button>
        </div>
      )}

      {/* Customer list */}
      {!showCreate && (
        <div className="cp-list">
          {loading && <div className="cp-loading">Loading customers…</div>}
          {!loading && filtered.length === 0 && search.trim() && (
            <div className="cp-empty">
              No matches.{' '}
              <button type="button" className="btn-link" onClick={() => { setShowCreate(true); setNewCust(p => ({ ...p, name: search.trim() })); }}>
                Add "{search.trim()}"
              </button>
            </div>
          )}
          {filtered.map(c => (
            <button
              key={c.id}
              type="button"
              className="cp-option"
              onClick={() => onSelect(c)}
            >
              <span className="cp-option-name">{c.name || 'Unnamed'}</span>
              {c.phone && <span className="cp-option-phone">{c.phone}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
