// ── Phase 0 primitives ──
export { default as Card }             from './Card';
export { default as Section }          from './Section';
export { default as PageHeader }       from './PageHeader';
export { default as Stat }             from './Stat';
export { default as RevealOnView }     from './RevealOnView';
export { default as Toggle }           from './Toggle';
export { default as TermsBody }        from './TermsBody';
export { default as Alert }            from './Alert';
export { default as SmsComposerField } from './SmsComposerField';
export { default as CopyChip }         from './CopyChip';
export { default as ConvAvatar }       from '../conv-avatar';

// ── Phase 2 primitives ──
export { default as Input }            from './Input';
export { default as Select }           from './Select';
export { default as Textarea }         from './Textarea';
export { default as Badge }            from './Badge';
export { default as Modal }            from './Modal';
export { default as Drawer }           from './Drawer';

// ── Page-level (not shared — import directly where needed) ──
// FunnelChart → import from './FunnelChart' in analytics-page only
// StepDots   → import from './StepDots' in onboarding-wizard only
