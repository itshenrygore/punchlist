import { useEffect, useRef, useState, useCallback } from 'react';

const COLORS = ['#f97316', '#ef4444', '#3b82f6', '#22c55e', '#fff'];
const SIZES = [3, 6, 10];

export default function PhotoAnnotator({ src, onSave, onClose }) {
  const canvasRef = useRef(null);
  const imgRef = useRef(null);
  const [drawing, setDrawing] = useState(false);
  const [color, setColor] = useState(COLORS[0]);
  const [size, setSize] = useState(SIZES[1]);
  const [tool, setTool] = useState('pen');
  const [loaded, setLoaded] = useState(false);
  const pathsRef = useRef([]);
  const currentPathRef = useRef([]);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    for (const p of pathsRef.current) drawPath(ctx, p);
  }, []);

  function drawPath(ctx, p) {
    if (p.points.length < 2) return;
    ctx.beginPath();
    ctx.strokeStyle = p.color;
    ctx.lineWidth = p.size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (p.tool === 'arrow') {
      const start = p.points[0];
      const end = p.points[p.points.length - 1];
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
      const angle = Math.atan2(end.y - start.y, end.x - start.x);
      const headLen = Math.max(12, p.size * 3);
      ctx.beginPath();
      ctx.moveTo(end.x, end.y);
      ctx.lineTo(end.x - headLen * Math.cos(angle - 0.4), end.y - headLen * Math.sin(angle - 0.4));
      ctx.moveTo(end.x, end.y);
      ctx.lineTo(end.x - headLen * Math.cos(angle + 0.4), end.y - headLen * Math.sin(angle + 0.4));
      ctx.stroke();
    } else {
      ctx.moveTo(p.points[0].x, p.points[0].y);
      for (let i = 1; i < p.points.length; i++) ctx.lineTo(p.points[i].x, p.points[i].y);
      ctx.stroke();
    }
  }

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imgRef.current = img;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const maxW = Math.min(window.innerWidth - 32, 800);
      const scale = maxW / img.naturalWidth;
      canvas.width = maxW;
      canvas.height = img.naturalHeight * scale;
      redraw();
      setLoaded(true);
    };
    img.src = src;
  }, [src, redraw]);

  function getPos(e) {
    const rect = canvasRef.current.getBoundingClientRect();
    const touch = e.touches?.[0];
    const clientX = touch ? touch.clientX : e.clientX;
    const clientY = touch ? touch.clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  function startDraw(e) {
    e.preventDefault();
    setDrawing(true);
    currentPathRef.current = [getPos(e)];
  }

  function moveDraw(e) {
    if (!drawing) return;
    e.preventDefault();
    currentPathRef.current.push(getPos(e));
    redraw();
    const ctx = canvasRef.current.getContext('2d');
    drawPath(ctx, { points: currentPathRef.current, color, size, tool });
  }

  function endDraw() {
    if (!drawing) return;
    setDrawing(false);
    if (currentPathRef.current.length > 1) {
      pathsRef.current.push({ points: currentPathRef.current, color, size, tool });
    }
    currentPathRef.current = [];
    redraw();
  }

  function undo() {
    pathsRef.current.pop();
    redraw();
  }

  function handleSave() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob(blob => {
      if (blob) onSave(blob);
    }, 'image/jpeg', 0.92);
  }

  return (
    <div className="pa-overlay" onClick={onClose}>
      <div className="pa-dialog" onClick={e => e.stopPropagation()}>
        <div className="pa-toolbar">
          <div className="pa-tool-group">
            <button type="button" className={`pa-tool-btn${tool === 'pen' ? ' pa-tool--active' : ''}`} onClick={() => setTool('pen')} title="Pen">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/></svg>
            </button>
            <button type="button" className={`pa-tool-btn${tool === 'arrow' ? ' pa-tool--active' : ''}`} onClick={() => setTool('arrow')} title="Arrow">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
            </button>
          </div>
          <div className="pa-tool-group">
            {COLORS.map(c => (
              <button key={c} type="button" className={`pa-color${c === color ? ' pa-color--active' : ''}`} style={{ background: c }} onClick={() => setColor(c)} />
            ))}
          </div>
          <div className="pa-tool-group">
            {SIZES.map(s => (
              <button key={s} type="button" className={`pa-size${s === size ? ' pa-size--active' : ''}`} onClick={() => setSize(s)}>
                <span style={{ width: s + 4, height: s + 4, borderRadius: '50%', background: 'currentColor', display: 'block' }} />
              </button>
            ))}
          </div>
          <button type="button" className="pa-tool-btn" onClick={undo} title="Undo" disabled={!pathsRef.current.length}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
          </button>
        </div>
        <div className="pa-canvas-wrap">
          {!loaded && <div className="pa-loading">Loading…</div>}
          <canvas
            ref={canvasRef}
            className="pa-canvas"
            onMouseDown={startDraw} onMouseMove={moveDraw} onMouseUp={endDraw} onMouseLeave={endDraw}
            onTouchStart={startDraw} onTouchMove={moveDraw} onTouchEnd={endDraw}
            style={{ touchAction: 'none', cursor: 'crosshair' }}
          />
        </div>
        <div className="pa-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={handleSave}>Save markup</button>
        </div>
      </div>
    </div>
  );
}
