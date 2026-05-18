import { createContext, useContext, useState, useCallback } from 'react';

const ForemanContext = createContext({
  quoteContext: null,
  setQuoteContext: () => {},
  addItemHandler: null,
  setAddItemHandler: () => {},
});

export function ForemanProvider({ children }) {
  const [quoteContext, setQuoteContext] = useState(null);
  const [addItemHandler, setAddItemHandler] = useState(null);

  return (
    <ForemanContext.Provider value={{ quoteContext, setQuoteContext, addItemHandler, setAddItemHandler }}>
      {children}
    </ForemanContext.Provider>
  );
}

export function useForeman() {
  return useContext(ForemanContext);
}
