import { createContext, useContext } from 'react';

/* ═══════════════════════════════════════════════════════════
   QuoteBuilderContext — Phase 1 shared context.

   The orchestrator provides:
     state    — full reducer state (read-only for children)
     dispatch — reducer dispatch
     ud       — shortcut for updating a single draft field
     refs     — shared refs (savingRef, dirty, initialLoadComplete, etc.)
     actions  — bound action helpers (save, handleSend, etc.)
     derived  — computed values (totals, grandTotal, selCustomer, etc.)
   ═══════════════════════════════════════════════════════════ */

const QuoteBuilderContext = createContext(null);

export function QuoteBuilderProvider({ value, children }) {
  return (
    <QuoteBuilderContext.Provider value={value}>
      {children}
    </QuoteBuilderContext.Provider>
  );
}

export function useQuoteBuilder() {
  const ctx = useContext(QuoteBuilderContext);
  if (!ctx) {
    throw new Error('useQuoteBuilder must be used within a QuoteBuilderProvider');
  }
  return ctx;
}

export default QuoteBuilderContext;
