import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import AppShell from '../components/app-shell';
import { getProfile, listCustomers, findCustomerMatches, createCustomer, createQuote, updateQuote, uploadQuotePhoto, extractContactName, getQuote } from '../lib/api';
import { useAuth } from '../hooks/use-auth';
import { useToast } from '../components/toast';
import { TRADES } from '../../shared/tradeBrain';

import { CA_PROVINCES, US_STATES } from '../lib/pricing';
const PLACEHOLDERS = {
  Plumber: 'Replace 50-gallon hot water tank in utility room. Drain, disconnect, and haul away old tank.',
  Electrician: 'Upgrade 100A panel to 200A service and reconnect existing circuits.',
  HVAC: 'Replace furnace with high-efficiency unit. Install new smart thermostat.',
  'General Contractor': 'Frame basement mechanical room and patch surrounding drywall.',
  Roofing: 'Replace damaged shingles around vent stack and inspect flashing.',
  Painter: 'Prep and paint main floor walls. Patch minor nail holes, sand, prime.',
  Carpenter: 'Install baseboard and door casing trim throughout main floor.',
  Other: 'Replace 50-gallon hot water tank in tight utility room.',
};

const NAME_PLACEHOLDERS = {
  Plumber: 'e.g. Replace hot water tank',
  Electrician: 'e.g. Panel upgrade to 200A',
  HVAC: 'e.g. Furnace replacement',
  'General Contractor': 'e.g. Basement framing',
  Roofing: 'e.g. Shingle repair around vent stack',
  Painter: 'e.g. Main floor repaint',
  Carpenter: 'e.g. Baseboard and trim install',
  Handyman: 'e.g. Fix leaky faucet + door adjustment',
  Landscaping: 'e.g. Spring cleanup and pruning',
  Other: 'e.g. Replace kitchen faucet',
};

export default function JobDetailsPage() {
  const { user } = useAuth();
  const nav = useNavigate();
  const { quoteId: editQuoteId } = useParams();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { show: toast } = useToast();
  const fileRef = useRef(null);

  const [trade, setTrade] = useState('Other');
  const [province, setProvince] = useState('AB');
  const [country, setCountry] = useState('CA');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState(location.state?.prefill || '');
  const [customerId, setCustomerId] = useState(searchParams.get('customer') || '');
  const [customers, setCustomers] = useState([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [showNewCust, setShowNewCust] = useState(false);
  const [newCust, setNewCust] = useState({ name: '', email: '', phone: '', address: '' });
  const [photo, setPhoto] = useState(null);
  const [listening, setListening] = useState(false);
  const recRef = useRef(null);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!user) return;
    Promise.all([listCustomers(user.id), getProfile(user.id)]).then(([c, p]) => {
      setCustomers(c || []);
      if (!editQuoteId) {
        if (p?.trade) setTrade(p.trade);
        if (p?.province) setProvince(p.province);
        if (p?.country) setCountry(p.country);
      }
    }).catch(() => {});

    // In edit mode, load the existing quote data
    if (editQuoteId) {
      getQuote(editQuoteId).then(q => {
        if (q) {
          setTitle(q.title || '');
          setDescription(q.description || '');
          if (q.trade) setTrade(q.trade);
          if (q.province) setProvince(q.province);
          if (q.country) setCountry(q.country);
          if (q.customer_id) setCustomerId(q.customer_id);
          titleSuggested.current = true; // Don't auto-generate title over loaded one
        }
      }).catch(() => {});
      return; // Skip demo carry-through in edit mode
    }

    // Handle demo job from onboarding
    const demoDesc = searchParams.get('demo');
    const demoTrade = searchParams.get('trade');
    if (demoDesc) setDescription(demoDesc);
    if (demoTrade) setTrade(demoTrade);

    // Handle demo quote carry-through from landing page interactive demo
    try {
      const demoQuote = sessionStorage.getItem('pl_demo_quote');
      if (demoQuote) {
        const d = JSON.parse(demoQuote);
        if (d.description) setDescription(d.description);
        if (d.trade) setTrade(d.trade);
        sessionStorage.removeItem('pl_demo_quote');
      }
    } catch {}
  }, [user, editQuoteId]);

  const titleSuggested = useRef(false);

  useEffect(() => {
    if (!title.trim() && description.trim() && !titleSuggested.current) {
      const g = description.split(/[.!?\n]/)[0]?.slice(0, 64);
      if (g) { setTitle(g); titleSuggested.current = true; }
    }
  }, [description]);

  const selCustomer = customers.find(c => c.id === customerId);
  const custMatches = customerSearch.trim()
    ? customers.filter(c => [c.name, c.email, c.phone].some(v => String(v || '').toLowerCase().includes(customerSearch.toLowerCase()))).slice(0, 6)
    : [];

  async function addCustInline() {
    if (!newCust.name.trim()) return setError('Name required');
    try {
      const c = await createCustomer(user.id, newCust);
      setCustomers(p => [...p, c].sort((a, b) => a.name.localeCompare(b.name)));
      setCustomerId(c.id);
      setShowNewCust(false);
      setNewCust({ name: '', email: '', phone: '', address: '' });
      setCustomerSearch('');
      toast('Contact saved', 'success');
    } catch (e) { setError('Something went wrong. Please try again.'); }
  }

  async function handleBuildScope() {
    if (!description.trim()) return setError('Describe the job first');
    setCreating(true);
    setError('');
    try {
      let draftId;

      if (editQuoteId) {
        // Edit mode: update existing draft's job details
        await updateQuote(editQuoteId, {
          title: title || description.slice(0, 64),
          description,
          trade,
          province,
          country,
          customer_id: customerId || null,
        });
        draftId = editQuoteId;
      } else {
        // Create mode: create a new draft quote
        const draft = await createQuote(user.id, {
          title: title || description.slice(0, 64),
          description,
          trade,
          province,
          country,
          customer_id: customerId || null,
          status: 'draft',
          line_items: [],
        });
        draftId = draft.id;
      }

      // Upload photo to Supabase Storage (if present) and store URL on the quote record
      // The File object is held in React state — no base64 truncation, no sessionStorage
      if (photo) {
        try {
          const { url } = await uploadQuotePhoto(draftId, photo);
          await updateQuote(draftId, { photo_url: url });
        } catch (photoErr) {
          // Photo upload failed — log and continue without it (non-fatal)
          console.warn('[Punchlist] Photo upload failed, proceeding without photo:', photoErr.message);
        }
      }

      nav(`/app/quotes/build-scope/${draftId}`);
    } catch (e) {
      console.error('[Punchlist] Draft creation failed:', e);
      setError(e.message || 'Failed to create draft. Please try again.');
    } finally {
      setCreating(false);
    }
  }

  const placeholder = PLACEHOLDERS[trade] || PLACEHOLDERS.Other;

  return (
    <AppShell title="New Quote" subtitle="Step 1 of 3">
      <div className="jd-page">
        <div className="jd-card">
          {/* Description — the most important field, FIRST */}
          <div className="jd-section">
            <label className="jd-label">Describe the work</label>
            <textarea className="jd-input jd-textarea" data-testid="jd-description" value={description} onChange={e => setDescription(e.target.value)} placeholder={placeholder} rows={4} autoFocus />
            {!description.trim() && <div className="jd-hint">Tip: A few sentences is all you need. Describe what you'd tell a helper on-site.</div>}
            <div className="jd-input-helpers">
              <button className={`jd-helper-btn ${listening ? 'jd-voice-active' : ''}`} type="button" onClick={() => {
                if (listening) {
                  // Stop recording
                  if (recRef.current) { recRef.current.stop(); recRef.current = null; }
                  setListening(false);
                  return;
                }
                const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
                if (!SR) { setError('Voice input not supported in this browser. Try typing instead.'); return; }
                const rec = new SR();
                rec.lang = 'en-US';
                rec.continuous = false; // Single utterance — stops after pause, more reliable
                rec.interimResults = true;
                recRef.current = rec;
                setListening(true);
                let finalText = '';
                rec.onresult = e => {
                  let interim = '';
                  for (let i = e.resultIndex; i < e.results.length; i++) {
                    const t = e.results[i][0].transcript;
                    if (e.results[i].isFinal) { finalText += t; } else { interim = t; }
                  }
                  // Show live preview: existing text + final so far + interim in grey
                  const base = description.trim();
                  const preview = [base, finalText, interim].filter(Boolean).join(' ');
                  setDescription(preview);
                };
                rec.onerror = () => { setListening(false); recRef.current = null; };
                rec.onend = () => {
                  setListening(false); recRef.current = null;
                  if (finalText.trim()) {
                    setDescription(prev => {
                      const base = prev.replace(finalText, '').trim();
                      return [base, finalText].filter(Boolean).join(' ');
                    });
                    toast('Got it', 'success');
                  }
                };
                rec.start();
                // 15s hard timeout
                setTimeout(() => { if (recRef.current) { recRef.current.stop(); recRef.current = null; setListening(false); } }, 15000);
              }}>{listening ? '⏹ Stop' : '🎤 Voice'}</button>
              {photo ? (
                <div className="jd-helper-btn jd-photo-active">📎 {photo.name} <button type="button" onClick={() => setPhoto(null)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: 0, marginLeft: 4 }}>✕</button></div>
              ) : (
                <button className="jd-helper-btn" type="button" onClick={() => fileRef.current?.click()}>📷 Photo</button>
              )}
              <input hidden ref={fileRef} type="file" accept="image/*" onChange={e => setPhoto(e.target.files?.[0] || null)} />
            </div>
          </div>

          {/* Customer — deferred to review step for less friction */}
          {/* Customer selection has been moved to review-quote-page to reduce 
              friction on first quote creation. Users can add customer when they 
              review and send. */}

          {/* Job name — auto-generated from description, no user input needed */}
          {title && (
            <div className="jd-section" style={{ opacity: 0.7 }}>
              <label className="jd-label" style={{ fontSize: 11 }}>Auto-detected job name</label>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', padding: '6px 0' }}>{title}</div>
            </div>
          )}

          {/* Trade + Province — collapsed by default (AI infers trade) */}
          <details style={{ marginTop: -4 }}>
            <summary style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', cursor: 'pointer', padding: '6px 0' }}>
              Trade: {trade} · {country === 'US' ? 'State' : 'Province'}: {province} <span style={{ fontSize: 10, color: 'var(--subtle)' }}>(tap to change)</span>
            </summary>
            <div className="jd-row" style={{ marginTop: 8 }}>
              <div className="jd-section" style={{ flex: 1 }}>
                <label className="jd-label">Trade</label>
                <select className="jd-input jd-select" value={trade} onChange={e => setTrade(e.target.value)}>
                  {TRADES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div className="jd-section" style={{ flex: 1 }}>
                <label className="jd-label">{country === 'US' ? 'State' : 'Province'}</label>
                <select className="jd-input jd-select" value={province} onChange={e => setProvince(e.target.value)}>
                  {(country === 'US' ? US_STATES : CA_PROVINCES).map(p => <option key={p}>{p}</option>)}
                </select>
              </div>
            </div>
          </details>

          {error && <div className="jd-error">{error}</div>}
        </div>

        {/* Primary CTA */}
        <div className="jd-footer">
          <button className="btn btn-primary btn-lg full-width" type="button" data-testid="jd-build-btn" onClick={handleBuildScope} disabled={!description.trim() || creating}>
            {creating ? 'Creating draft…' : 'Build Quote →'}
          </button>
          <button className="jd-skip-ai" type="button" data-testid="jd-skip-ai" onClick={async () => {
            if (!description.trim()) return setError('Describe the job first');
            setCreating(true);
            try {
              const draft = await createQuote(user.id, {
                title: title || description.slice(0, 64),
                description, trade, province, country,
                customer_id: customerId || null, status: 'draft', line_items: [],
              });
              nav(`/app/quotes/review/${draft.id}`);
            } catch (e) { setError(e.message || 'Failed to create draft.'); }
            finally { setCreating(false); }
          }} disabled={!description.trim() || creating}>
            Skip AI — build manually
          </button>
          {!description.trim() && <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--subtle)', marginTop: 6 }}>Describe the work above to get started</div>}
        </div>
      </div>
    </AppShell>
  );
}
