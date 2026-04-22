import { useEffect, useRef, useState } from 'react';

/**
 * SignaturePad — Draw + Type tabs for e-signature capture.
 *
 * Props:
 *   onSave({ signature_data, signer_name })  — called when user submits
 *   onCancel()                                — called when user cancels
 *   saveLabel   (string)                      — CTA button text (e.g. "Sign & Approve Quote")
 *   legalText   (string)                      — small print below button
 *   hasTerms    (bool)                        — if true, require termsAccepted before save
 *   termsAccepted (bool)                      — external terms checkbox state
 */
export default function SignaturePad({
  onSave,
  onCancel,
  saveLabel = 'Sign & Approve',
  legalText = 'By signing, you agree to the scope and pricing.',
  hasTerms = false,
  termsAccepted = false,
  defaultName = '',
}) {
  const canvasRef = useRef(null);
  const typeCanvasRef = useRef(null);
  const [tab, setTab] = useState('draw');
  const [drawing, setDrawing] = useState(false);
  const [hasStrokes, setHasStrokes] = useState(false);
  const [signerName, setSignerName] = useState(defaultName);
  const [typedName, setTypedName] = useState('');

  useEffect(() => {
    if (tab !== 'draw') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    ctx.strokeStyle = '#14161a';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, [tab]);

  useEffect(() => {
    if (tab !== 'type') return;
    const canvas = typeCanvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, rect.width, rect.height);
    if (typedName.trim()) {
      const fontSize = Math.min(42, Math.max(24, Math.floor(rect.width / (typedName.length * 0.65))));
      ctx.font = `italic ${fontSize}px Georgia, 'Times New Roman', serif`;
      ctx.fillStyle = '#14161a';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(typedName.trim(), rect.width / 2, rect.height / 2);
    }
  }, [typedName, tab]);

  function getPos(e) {
    const rect = canvasRef.current.getBoundingClientRect();
    const touch = e.touches ? e.touches[0] : e;
    return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
  }

  function startDraw(e) {
    e.preventDefault();
    const ctx = canvasRef.current.getContext('2d');
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    setDrawing(true);
  }

  function draw(e) {
    if (!drawing) return;
    e.preventDefault();
    const ctx = canvasRef.current.getContext('2d');
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    setHasStrokes(true);
  }

  function endDraw() { setDrawing(false); }

  function clearPad() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    setHasStrokes(false);
  }

  function handleSave() {
    const name = signerName.trim();
    if (!name) return;
    let dataUrl;
    if (tab === 'draw') {
      if (!hasStrokes) return;
      dataUrl = canvasRef.current.toDataURL('image/png');
    } else {
      if (!typedName.trim()) return;
      dataUrl = typeCanvasRef.current.toDataURL('image/png');
    }
    onSave({ signature_data: dataUrl, signer_name: name });
  }

  const sigReady = signerName.trim() && (tab === 'draw' ? hasStrokes : typedName.trim());
  const canSave = sigReady && (!hasTerms || termsAccepted);

  return (
    <div className="doc-sig-pad-container">
      <div style={{ marginBottom: 12 }}>
        <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 4, color: 'var(--doc-text)' }}>Full name</label>
        <input type="text" value={signerName} onChange={e => setSignerName(e.target.value)} placeholder="Your full name" autoFocus={!defaultName}
          style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--doc-border)', borderRadius: 8, fontSize: 'var(--text-base)', background: 'var(--surface)', boxSizing: 'border-box' }} />
      </div>

      <div style={{ display: 'flex', gap: 0, marginBottom: 8, border: '1px solid var(--doc-border)', borderRadius: 8, overflow: 'hidden' }}>
        {[{ v: 'draw', l: 'Draw' }, { v: 'type', l: 'Aa Type' }].map(t => (
          <button key={t.v} type="button" onClick={() => setTab(t.v)}
            style={{ flex: 1, padding: '8px 12px', fontSize: 'var(--text-sm)', fontWeight: 600, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              background: tab === t.v ? 'var(--doc-text)' : 'var(--panel)', color: tab === t.v ? 'var(--panel)' : 'var(--muted)', transition: 'all .15s' }}>
            {t.l}
          </button>
        ))}
      </div>

      {tab === 'draw' && (
        <>
          <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 4, color: 'var(--doc-text)' }}>Signature</label>
          <div style={{ border: '1px solid var(--doc-border)', borderRadius: 8, overflow: 'hidden', background: 'var(--panel-2)', position: 'relative', touchAction: 'none' }}>
            <canvas ref={canvasRef} style={{ width: '100%', height: 140, display: 'block', cursor: 'crosshair' }}
              onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw} onMouseLeave={endDraw}
              onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={endDraw} />
            {!hasStrokes && <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', color: 'var(--muted)', fontSize: 'var(--text-sm)', pointerEvents: 'none' }}>Sign here with your finger or mouse</div>}
          </div>
          {hasStrokes && <button type="button" onClick={clearPad} style={{ marginTop: 6, padding: '4px 12px', fontSize: 'var(--text-xs)', background: 'none', border: 'none', color: 'var(--doc-muted)', cursor: 'pointer', textDecoration: 'underline', fontFamily: 'inherit' }}>Clear signature</button>}
        </>
      )}

      {tab === 'type' && (
        <>
          <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 4, color: 'var(--doc-text)' }}>Type your name to sign</label>
          <input type="text" value={typedName} onChange={e => setTypedName(e.target.value)} placeholder="Your name"
            style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--doc-border)', borderRadius: 8, fontSize: 'var(--text-base)', background: 'var(--surface)', boxSizing: 'border-box', marginBottom: 8 }} />
          {typedName.trim() && (
            <>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', marginBottom: 4 }}>Preview</div>
              <div style={{ border: '1px solid var(--doc-border)', borderRadius: 8, overflow: 'hidden', background: 'var(--panel-2, #fafafa)' }}>
                <canvas ref={typeCanvasRef} style={{ width: '100%', height: 90, display: 'block' }} />
              </div>
            </>
          )}
        </>
      )}

      {hasTerms && !termsAccepted && (
        <div style={{ marginTop: 10, padding: '10px 12px', background: 'var(--amber-bg, #fff7ed)', border: '1px solid var(--amber-line, #fed7aa)', borderRadius: 8, fontSize: 'var(--text-sm)', color: 'var(--amber-text)' }}>
          Please read and accept the terms &amp; conditions above before signing.
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button className="doc-cta-primary" type="button" disabled={!canSave} onClick={handleSave} style={{ flex: 1 }}>
          {saveLabel}
        </button>
        <button className="doc-cta-secondary" type="button" onClick={onCancel} style={{ flex: 0 }}>Cancel</button>
      </div>
      <p style={{ fontSize: 'var(--text-2xs)', color: 'var(--doc-muted)', marginTop: 8, textAlign: 'center' }}>
        {legalText}
      </p>
    </div>
  );
}
