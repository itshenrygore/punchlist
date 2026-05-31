import { createContext, useContext, useState, useCallback } from 'react';

const ForemanContext = createContext({
  quoteContext: null,
  setQuoteContext: () => {},
  addItemHandler: null,
  setAddItemHandler: () => {},
  openRequest: null,
  requestOpen: () => {},
  consumeOpenRequest: () => null,
});

export function ForemanProvider({ children }) {
  const [quoteContext, setQuoteContext] = useState(null);
  const [addItemHandler, setAddItemHandlerRaw] = useState(null);
  // openRequest: a one-shot signal from any feature ("open Foreman with this
  // pre-filled input"). AppShell reads it via consumeOpenRequest, opens the
  // panel, and the panel seeds the input. Cleared once consumed so the next
  // open doesn't re-seed.
  const [openRequest, setOpenRequest] = useState(null);

  // Storing a function in useState requires the lazy form
  // `setState(() => fn)` — otherwise React invokes `fn` with the
  // previous state and stores its return value. Wrap so consumers
  // can call `setAddItemHandler(fn)` directly with any function.
  const setAddItemHandler = useCallback(
    (fn) => setAddItemHandlerRaw(() => fn),
    [],
  );

  const requestOpen = useCallback((payload) => {
    // payload: { prefill?: string, autoSend?: boolean }
    setOpenRequest({ ...payload, _id: Date.now() });
  }, []);
  const consumeOpenRequest = useCallback(() => {
    const r = openRequest;
    if (r) setOpenRequest(null);
    return r;
  }, [openRequest]);

  return (
    <ForemanContext.Provider value={{
      quoteContext, setQuoteContext,
      addItemHandler, setAddItemHandler,
      openRequest, requestOpen, consumeOpenRequest,
    }}>
      {children}
    </ForemanContext.Provider>
  );
}

export function useForeman() {
  return useContext(ForemanContext);
}
