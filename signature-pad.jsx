// ═══════════════════════════════════════════════════════════════════════════
// PUNCHLIST — CopyChip (UX-015, UX-038)
// A compact copy-to-clipboard button with post-click state feedback.
//
// Pattern:
//   1. Default: Copy icon + label "Copy"
//   2. On click: writes to clipboard, transitions to Check icon + "Copied"
//      in green, aria-live announces to screen readers
//   3. After 1.5s: reverts to default state
//
// Props:
//   value    (string)  — text to copy
//   label    (string)  — button label, default "Copy"
//   copiedLabel (string) — label after copy, default "Copied"
//   size     (number)  — icon size, default 12
//   className (string) — extra classes on root button
// ═══════════════════════════════════════════════════════════════════════════
import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

export default function CopyChip({
  value,
  label = 'Copy',
  copiedLabel = 'Copied',
  size = 12,
  className = '',
}) {
  const [copied, setCopied] = useState(false);

  async function handleClick() {
    if (copied) return;
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Fallback for browsers without clipboard API
      const el = document.createElement('textarea');
      el.value = value;
      el.style.position = 'fixed';
      el.style.opacity = '0';
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <>
      <button
        type="button"
        className={`pl-copy-chip${copied ? ' pl-copy-chip--copied' : ''}${className ? ` ${className}` : ''}`}
        onClick={handleClick}
        aria-label={copied ? copiedLabel : `${label}: ${value}`}
      >
        {copied
          ? <Check size={size} strokeWidth={2.5} />
          : <Copy size={size} strokeWidth={2} />}
        {copied ? copiedLabel : label}
      </button>
      {/* Screen-reader live region — announces "Copied to clipboard" on copy */}
      <span
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {copied ? 'Copied to clipboard' : ''}
      </span>
    </>
  );
}
