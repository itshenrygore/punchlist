import { createContext, useContext } from 'react';

const PublicQuoteContext = createContext(null);

export function PublicQuoteProvider({ value, children }) {
  return (
    <PublicQuoteContext.Provider value={value}>
      {children}
    </PublicQuoteContext.Provider>
  );
}

export function usePublicQuote() {
  const ctx = useContext(PublicQuoteContext);
  if (!ctx) throw new Error('usePublicQuote must be used within PublicQuoteProvider');
  return ctx;
}

export default PublicQuoteContext;
