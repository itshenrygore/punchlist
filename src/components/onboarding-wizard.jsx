import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getProfile, updateProfile } from '../lib/api';
import { useAuth } from '../hooks/use-auth';
import { CA_PROVINCES, US_STATES } from '../lib/pricing';
import { TRADES } from '../../shared/tradeBrain';

const DEMO_JOBS = [
  { label:'Water heater replacement', description:'Replace 50 gallon gas water heater. Drain, disconnect, and haul away old tank. Reconnect gas and venting.', trade:'Plumber' },
  { label:'Kitchen faucet swap', description:'Remove old kitchen faucet and install new single-handle faucet. Supply lines and shutoff valves.', trade:'Plumber' },
  { label:'Add two garage outlets', description:'Add two 20A outlets in the garage and check panel capacity. Permit if required.', trade:'Electrician' },
  { label:'Panel upgrade to 200A', description:'Upgrade 100A panel to 200A service. Transfer all existing circuits. Permit and inspection.', trade:'Electrician' },
  { label:'Furnace not heating', description:'Furnace short cycling, customer has no heat. Wants diagnostic, repair estimate, and parts allowance.', trade:'HVAC' },
  { label:'Central AC install', description:'New central AC for 2,000 sq ft home. Condenser, evaporator coil, line set, and thermostat.', trade:'HVAC' },
  { label:'Basement framing', description:'Frame basement mechanical room and patch surrounding drywall. Ready for inspection.', trade:'General Contractor' },
  { label:'Shingle repair', description:'Replace damaged shingles around vent stack. Inspect and re-seal flashing.', trade:'Roofing' },
  { label:'Main floor repaint', description:'Prep and paint main floor walls and trim. Patch minor nail holes, sand, prime, two coats.', trade:'Painter' },
  { label:'Baseboard and trim', description:'Install baseboard and door casing trim throughout main floor. Cut, fit, nail, fill, and caulk.', trade:'Carpenter' },
  { label:'Fix leaky faucet + door', description:'Repair kitchen faucet leak and adjust sticking interior door. Minor handyman visit.', trade:'Handyman' },
];

function markOnboarded() {
  try { localStorage.setItem('pl_onboarded', '1'); } catch {}
}

export default function OnboardingWizard({ onDismiss }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [trade, setTrade] = useState('Plumber');
  const [country, setCountry] = useState('CA');
  const [province, setProvince] = useState('AB');
  const [saving, setSaving] = useState(false);
  const [profileLoaded, setProfileLoaded] = useState(false);

  useEffect(() => {
    if (!user) return;
    getProfile(user.id).then(p => {
      if (p?.trade && p.trade !== 'Other') {
        setTrade(p.trade);
        setProvince(p.province || 'AB');
        setCountry(p.country || 'CA');
        // If trade is already set, skip to step 1 (the launch step)
        setStep(1);
      }
      setProfileLoaded(true);
    }).catch(() => setProfileLoaded(true));
  }, [user]);

  async function saveTrade() {
    setSaving(true);
    try {
      if (user) await updateProfile(user.id, { trade, province, country });
    } catch {}
    setSaving(false);
    setStep(1);
  }

  function startOwnQuote() {
    markOnboarded();
    onDismiss?.();
    navigate('/app/quotes/new');
  }

  function tryDemo(job) {
    markOnboarded();
    onDismiss?.();
    navigate(`/app/quotes/new?demo=${encodeURIComponent(job.description)}&trade=${job.trade}`);
  }

  function skipAll() {
    markOnboarded();
    onDismiss?.();
  }

  if (!profileLoaded) return null;

  return (
    <div className="ob-backdrop">
      <div className="ob-card">

        {step === 0 && (
          <>
            <h2 className="ob-title">What's your trade?</h2>
            <p className="ob-body">Helps us suggest the right line items and pricing for your jobs.</p>
            <div className="ob-fields">
              <div>
                <label className="ob-label">Trade</label>
                <select className="ob-select" value={trade} onChange={e => setTrade(e.target.value)}>
                  {TRADES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="ob-label">Country</label>
                <select className="ob-select" value={country} onChange={e => { setCountry(e.target.value); setProvince(e.target.value === 'US' ? 'CA' : 'AB'); }}>
                  <option value="CA">Canada</option>
                  <option value="US">United States</option>
                </select>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label className="ob-label">{country === 'US' ? 'State' : 'Province'}</label>
                <select className="ob-select" value={province} onChange={e => setProvince(e.target.value)}>
                  {(country === 'US' ? US_STATES : CA_PROVINCES).map(p => <option key={p}>{p}</option>)}
                </select>
              </div>
            </div>
            <button className="btn btn-primary full-width" type="button" disabled={saving} onClick={saveTrade}>
              {saving ? 'Saving…' : 'Continue →'}
            </button>
          </>
        )}

        {step === 1 && (() => {
          // Show trade-matched jobs first, then fallback to general ones
          const matched = DEMO_JOBS.filter(j => j.trade === trade);
          const others = DEMO_JOBS.filter(j => j.trade !== trade);
          const demoList = matched.length >= 2 ? matched.slice(0, 3) : [...matched, ...others].slice(0, 3);
          return (
          <>
            <div className="ob-icon">⚡</div>
            <h2 className="ob-title">Create your first quote</h2>
            <p className="ob-body">Describe a job, review the scope, and send a professional quote. Takes about 2 minutes.</p>
            <button className="btn btn-primary full-width" type="button" onClick={startOwnQuote}>
              Start my own quote →
            </button>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--subtle)', textAlign: 'center', margin: '12px 0 6px' }}>
              or try a sample job
            </div>
            <div className="ob-path-grid">
              {demoList.map(job => (
                <button key={job.label} className="ob-demo-card" type="button" onClick={() => tryDemo(job)}>
                  <span className="ob-demo-label">{job.label}</span>
                  <span className="ob-demo-trade">{job.trade}</span>
                </button>
              ))}
            </div>
            <button className="ob-skip" type="button" onClick={skipAll}>Skip to dashboard</button>
          </>
          );
        })()}

        <div className="ob-dots">
          {[0,1].map(i => <div key={i} className={`ob-dot ${i===step?'active':i<step?'done':''}`} />)}
        </div>
      </div>
    </div>
  );
}
