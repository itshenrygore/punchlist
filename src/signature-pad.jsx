import { Wrench } from 'lucide-react';

/**
 * ConvAvatar — conversation thread avatar
 * - customer: initials chip derived from name
 * - contractor: logo image if available, else initials chip of contractor_name
 */
export default function ConvAvatar({ role, name, logoUrl, size = 32 }) {
  const isContractor = role === 'contractor';

  if (isContractor && logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={name || 'Contractor'}
        className="conv-avatar conv-avatar--logo"
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
      />
    );
  }

  if (isContractor && !logoUrl) {
    // Wrench icon fallback for contractor (no logo)
    return (
      <div
        className="conv-avatar conv-avatar--contractor"
        style={{
          width: size, height: size, borderRadius: '50%', flexShrink: 0,
          background: 'var(--doc-accent-soft, rgba(184,81,40,.12))',
          color: 'var(--doc-accent, var(--brand))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
        aria-hidden="true"
      >
        <Wrench size={Math.round(size * 0.5)} />
      </div>
    );
  }

  // Customer: initials chip
  const initials = name
    ? name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : '?';

  return (
    <div
      className="conv-avatar conv-avatar--customer"
      style={{
        width: size, height: size, borderRadius: '50%', flexShrink: 0,
        background: 'var(--panel-3)',
        color: 'var(--text-2, var(--muted))',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 700,
        fontSize: Math.round(size * 0.38),
        letterSpacing: '-0.02em',
        userSelect: 'none',
      }}
      aria-hidden="true"
    >
      {initials}
    </div>
  );
}
