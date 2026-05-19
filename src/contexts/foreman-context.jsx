import { createContext, useContext, useState, useCallback } from 'react';

const ForemanContext = createContext({
  quoteContext: null,
  setQuoteContext: () => {},
  addItemHandler: null,
  setAddItemHandler: () => {},
});

export function ForemanProvider({ children }) {
  const [quoteContext, setQuoteContext] = useState(null);
  const [addItemHandler, setAddItemHandlerRaw] = useState(null);

  // Storing a function in useState requires the lazy form
  // `setState(() => fn)` — otherwise React invokes `fn` with the
  // previous state and stores its return value. Wrap so consumers
  // can call `setAddItemHandler(fn)` directly with any function.
  const setAddItemHandler = useCallback(
    (fn) => setAddItemHandlerRaw(() => fn),
    [],
  );

  return (
    <ForemanContext.Provider value={{ quoteContext, setQuoteContext, addItemHandler, setAddItemHandler }}>
      {children}
    </ForemanContext.Provider>
  );
}

export function useForeman() {
  return useContext(ForemanContext);
}
