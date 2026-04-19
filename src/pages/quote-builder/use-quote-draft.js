import { useReducer, useCallback } from 'react';
import { makeId } from '../../lib/utils';

/* ═══════════════════════════════════════════════════════════
   useQuoteDraft — Phase 1 reducer for the quote builder.

   Replaces 52 individual useState calls with a single reducer
   organized into 5 state zones:

     1. Job description (describe phase)
     2. AI scope (building phase)
     3. Quote details (review phase)
     4. Send flow (sending phase)
     5. Shared / cross-cutting state

   Every phase transition goes through ADVANCE_PHASE or SET_PHASE.
   ═══════════════════════════════════════════════════════════ */

// ── Initial state factory ──────────────────────────────────
export function createInitialState({ existingQuoteId, prefill }) {
  return {
    // Zone 1: Job Description
    description: prefill || '',
    title: '',
    trade: 'Other',
    province: 'AB',
    country: 'CA',
    photo: null,
    listening: false,
    photoSaved: false,

    // Zone 2: AI Scope
    suggestions: [],
    scopeLoading: false,
    scopeLoadingMsg: '',
    scopeError: false,
    expandedSugId: null,
    scopeGaps: [],
    scopeMeta: { scope_summary: '', assumptions: '', exclusions: '' },
    dismissedSugIds: new Set(),

    // Zone 3: Quote Details
    lineItems: [],
    draft: {
      title: '',
      description: '',
      scope_summary: '',
      assumptions: '',
      exclusions: '',
      customer_id: '',
      status: 'draft',
      expiry_days: 14,
      deposit_required: false,
      deposit_percent: 20,
      deposit_amount: 0,
      deposit_status: 'not_required',
      internal_notes: '',
      revision_summary: '',
      discount: 0,
    },
    customerSearch: '',
    showNewCust: false,
    newCust: { name: '', email: '', phone: '', address: '' },
    addMode: null,
    catalogQuery: '',
    catalogResults: [],
    editingItemId: null,
    showDetails: false,
    inlinePhone: '',
    companyName: '',
    leavingItemIds: new Set(),

    // Zone 4: Send
    deliveryMethod: 'text',
    smsBody: '',
    initialSmsTemplate: null,
    showSend: false,
    smsConfirmPending: null,
    sentSuccess: false,

    // Zone 5: Shared
    phase: existingQuoteId ? 'review' : 'describe',
    quoteId: existingQuoteId || null,
    saving: false,
    sending: false,
    error: '',
    saveState: '',
    lastSavedAt: null,
    userProfile: null,
    sentThisMonth: 0,
    isLocked: false,
    showUpgradeModal: false,
    zeroItemConfirm: null,
    offlineDraft: false,
    isDirty: false,
    showKbdHelp: false,
  };
}

// ── Action types ───────────────────────────────────────────
// Grouped by zone for readability. Each constant is prefixed
// so grep can find all actions for a given zone.

// Phase transitions
const SET_PHASE = 'SET_PHASE';

// Zone 1: Describe
const SET_DESCRIPTION = 'SET_DESCRIPTION';
const SET_TITLE = 'SET_TITLE';
const SET_TRADE = 'SET_TRADE';
const SET_PROVINCE = 'SET_PROVINCE';
const SET_COUNTRY = 'SET_COUNTRY';
const SET_PHOTO = 'SET_PHOTO';
const SET_LISTENING = 'SET_LISTENING';
const SET_PHOTO_SAVED = 'SET_PHOTO_SAVED';

// Zone 2: AI Scope
const SET_SUGGESTIONS = 'SET_SUGGESTIONS';
const SET_SCOPE_LOADING = 'SET_SCOPE_LOADING';
const SET_SCOPE_LOADING_MSG = 'SET_SCOPE_LOADING_MSG';
const SET_SCOPE_ERROR = 'SET_SCOPE_ERROR';
const SET_EXPANDED_SUG = 'SET_EXPANDED_SUG';
const SET_SCOPE_GAPS = 'SET_SCOPE_GAPS';
const SET_SCOPE_META = 'SET_SCOPE_META';
const DISMISS_SUGGESTION = 'DISMISS_SUGGESTION';

// Zone 3: Quote Details
const SET_LINE_ITEMS = 'SET_LINE_ITEMS';
const UPDATE_ITEM = 'UPDATE_ITEM';
const REMOVE_ITEM = 'REMOVE_ITEM';
const ADD_ITEM = 'ADD_ITEM';
const REORDER_ITEMS = 'REORDER_ITEMS';
const UPDATE_DRAFT = 'UPDATE_DRAFT';
const SET_DRAFT = 'SET_DRAFT';
const SET_CUSTOMER_SEARCH = 'SET_CUSTOMER_SEARCH';
const SET_SHOW_NEW_CUST = 'SET_SHOW_NEW_CUST';
const SET_NEW_CUST = 'SET_NEW_CUST';
const SET_ADD_MODE = 'SET_ADD_MODE';
const SET_CATALOG_QUERY = 'SET_CATALOG_QUERY';
const SET_CATALOG_RESULTS = 'SET_CATALOG_RESULTS';
const SET_EDITING_ITEM = 'SET_EDITING_ITEM';
const SET_SHOW_DETAILS = 'SET_SHOW_DETAILS';
const SET_INLINE_PHONE = 'SET_INLINE_PHONE';
const SET_COMPANY_NAME = 'SET_COMPANY_NAME';
const MARK_ITEM_LEAVING = 'MARK_ITEM_LEAVING';
const CLEAR_ITEM_LEAVING = 'CLEAR_ITEM_LEAVING';

// Zone 4: Send
const SET_DELIVERY_METHOD = 'SET_DELIVERY_METHOD';
const SET_SMS_BODY = 'SET_SMS_BODY';
const SET_INITIAL_SMS_TEMPLATE = 'SET_INITIAL_SMS_TEMPLATE';
const SET_SHOW_SEND = 'SET_SHOW_SEND';
const SET_SMS_CONFIRM_PENDING = 'SET_SMS_CONFIRM_PENDING';
const SET_SENT_SUCCESS = 'SET_SENT_SUCCESS';

// Zone 5: Shared
const SET_QUOTE_ID = 'SET_QUOTE_ID';
const SET_SAVING = 'SET_SAVING';
const SET_SENDING = 'SET_SENDING';
const SET_ERROR = 'SET_ERROR';
const SET_SAVE_STATE = 'SET_SAVE_STATE';
const SET_LAST_SAVED_AT = 'SET_LAST_SAVED_AT';
const SET_USER_PROFILE = 'SET_USER_PROFILE';
const SET_SENT_THIS_MONTH = 'SET_SENT_THIS_MONTH';
const SET_IS_LOCKED = 'SET_IS_LOCKED';
const SET_SHOW_UPGRADE_MODAL = 'SET_SHOW_UPGRADE_MODAL';
const SET_ZERO_ITEM_CONFIRM = 'SET_ZERO_ITEM_CONFIRM';
const SET_OFFLINE_DRAFT = 'SET_OFFLINE_DRAFT';
const MARK_DIRTY = 'MARK_DIRTY';
const CLEAR_DIRTY = 'CLEAR_DIRTY';
const SET_SHOW_KBD_HELP = 'SET_SHOW_KBD_HELP';
const BATCH = 'BATCH';
const RESET_FOR_NEW_QUOTE = 'RESET_FOR_NEW_QUOTE';

// ── Reducer ────────────────────────────────────────────────
function quoteDraftReducer(state, action) {
  switch (action.type) {
    // ── Batch: process multiple actions atomically ──
    case BATCH:
      return action.actions.reduce(quoteDraftReducer, state);

    // ── Phase transitions ──
    case SET_PHASE:
      return { ...state, phase: action.phase };

    // ── Zone 1: Describe ──
    case SET_DESCRIPTION:
      return { ...state, description: action.value };
    case SET_TITLE:
      return { ...state, title: action.value };
    case SET_TRADE:
      return { ...state, trade: action.value };
    case SET_PROVINCE:
      return { ...state, province: action.value };
    case SET_COUNTRY:
      return { ...state, country: action.value };
    case SET_PHOTO:
      return { ...state, photo: action.value };
    case SET_LISTENING:
      return { ...state, listening: action.value };
    case SET_PHOTO_SAVED:
      return { ...state, photoSaved: action.value };

    // ── Zone 2: AI Scope ──
    case SET_SUGGESTIONS:
      return { ...state, suggestions: action.value };
    case SET_SCOPE_LOADING:
      return { ...state, scopeLoading: action.value };
    case SET_SCOPE_LOADING_MSG:
      return { ...state, scopeLoadingMsg: action.value };
    case SET_SCOPE_ERROR:
      return { ...state, scopeError: action.value };
    case SET_EXPANDED_SUG:
      return { ...state, expandedSugId: action.value };
    case SET_SCOPE_GAPS:
      return { ...state, scopeGaps: action.value };
    case SET_SCOPE_META:
      return { ...state, scopeMeta: action.value };
    case DISMISS_SUGGESTION: {
      const next = new Set(state.dismissedSugIds);
      next.add(action.id);
      return { ...state, dismissedSugIds: next };
    }

    // ── Zone 3: Quote Details ──
    case SET_LINE_ITEMS:
      return { ...state, lineItems: action.value, isDirty: action.markDirty !== false ? true : state.isDirty };
    case UPDATE_ITEM:
      return {
        ...state,
        lineItems: state.lineItems.map(i =>
          i.id === action.id ? { ...i, ...action.changes } : i
        ),
        isDirty: true,
      };
    case REMOVE_ITEM:
      return {
        ...state,
        lineItems: state.lineItems.filter(i => i.id !== action.id),
        isDirty: true,
      };
    case ADD_ITEM:
      return {
        ...state,
        lineItems: [...state.lineItems, action.item],
        isDirty: true,
      };
    case REORDER_ITEMS: {
      const items = [...state.lineItems];
      const [moved] = items.splice(action.from, 1);
      items.splice(action.to, 0, moved);
      return { ...state, lineItems: items, isDirty: true };
    }
    case UPDATE_DRAFT:
      return {
        ...state,
        draft: { ...state.draft, [action.key]: action.value },
        isDirty: true,
      };
    case SET_DRAFT:
      return { ...state, draft: typeof action.value === 'function' ? action.value(state.draft) : action.value };
    case SET_CUSTOMER_SEARCH:
      return { ...state, customerSearch: action.value };
    case SET_SHOW_NEW_CUST:
      return { ...state, showNewCust: action.value };
    case SET_NEW_CUST:
      return { ...state, newCust: typeof action.value === 'function' ? action.value(state.newCust) : action.value };
    case SET_ADD_MODE:
      return { ...state, addMode: action.value };
    case SET_CATALOG_QUERY:
      return { ...state, catalogQuery: action.value };
    case SET_CATALOG_RESULTS:
      return { ...state, catalogResults: action.value };
    case SET_EDITING_ITEM:
      return { ...state, editingItemId: action.value };
    case SET_SHOW_DETAILS:
      return { ...state, showDetails: action.value };
    case SET_INLINE_PHONE:
      return { ...state, inlinePhone: action.value };
    case SET_COMPANY_NAME:
      return { ...state, companyName: action.value };
    case MARK_ITEM_LEAVING: {
      const next = new Set(state.leavingItemIds);
      next.add(action.id);
      return { ...state, leavingItemIds: next };
    }
    case CLEAR_ITEM_LEAVING: {
      const next = new Set(state.leavingItemIds);
      next.delete(action.id);
      return { ...state, leavingItemIds: next };
    }

    // ── Zone 4: Send ──
    case SET_DELIVERY_METHOD:
      return { ...state, deliveryMethod: action.value };
    case SET_SMS_BODY:
      return { ...state, smsBody: action.value };
    case SET_INITIAL_SMS_TEMPLATE:
      return { ...state, initialSmsTemplate: action.value };
    case SET_SHOW_SEND:
      return { ...state, showSend: action.value };
    case SET_SMS_CONFIRM_PENDING:
      return { ...state, smsConfirmPending: action.value };
    case SET_SENT_SUCCESS:
      return { ...state, sentSuccess: action.value };

    // ── Zone 5: Shared ──
    case SET_QUOTE_ID:
      return { ...state, quoteId: action.value };
    case SET_SAVING:
      return { ...state, saving: action.value };
    case SET_SENDING:
      return { ...state, sending: action.value };
    case SET_ERROR:
      return { ...state, error: action.value };
    case SET_SAVE_STATE:
      return { ...state, saveState: action.value };
    case SET_LAST_SAVED_AT:
      return { ...state, lastSavedAt: action.value };
    case SET_USER_PROFILE:
      return { ...state, userProfile: action.value };
    case SET_SENT_THIS_MONTH:
      return { ...state, sentThisMonth: action.value };
    case SET_IS_LOCKED:
      return { ...state, isLocked: action.value };
    case SET_SHOW_UPGRADE_MODAL:
      return { ...state, showUpgradeModal: action.value };
    case SET_ZERO_ITEM_CONFIRM:
      return { ...state, zeroItemConfirm: action.value };
    case SET_OFFLINE_DRAFT:
      return { ...state, offlineDraft: action.value };
    case MARK_DIRTY:
      return { ...state, isDirty: true };
    case CLEAR_DIRTY:
      return { ...state, isDirty: false };
    case SET_SHOW_KBD_HELP:
      return { ...state, showKbdHelp: typeof action.value === 'function' ? action.value(state.showKbdHelp) : action.value };

    // ── Full reset for "New quote" from sent phase ──
    case RESET_FOR_NEW_QUOTE:
      return {
        ...createInitialState({ existingQuoteId: null, prefill: '' }),
        userProfile: state.userProfile,
        trade: state.trade,
        province: state.province,
        country: state.country,
        companyName: state.companyName,
        sentThisMonth: state.sentThisMonth,
        initialSmsTemplate: state.initialSmsTemplate,
      };

    default:
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`[useQuoteDraft] Unknown action: ${action.type}`);
      }
      return state;
  }
}

// ── Hook ───────────────────────────────────────────────────
export default function useQuoteDraft({ existingQuoteId, prefill }) {
  const [state, dispatch] = useReducer(
    quoteDraftReducer,
    { existingQuoteId, prefill },
    createInitialState
  );

  // Convenience: update a single draft field and mark dirty
  const ud = useCallback((key, value) => {
    dispatch({ type: UPDATE_DRAFT, key, value });
  }, []);

  return [state, dispatch, ud];
}

// ── Export action creators for use in child components ─────
// These are plain objects, not functions — keeps bundle small.
export const actions = {
  setPhase:             (phase) => ({ type: SET_PHASE, phase }),
  setDescription:       (value) => ({ type: SET_DESCRIPTION, value }),
  setTitle:             (value) => ({ type: SET_TITLE, value }),
  setTrade:             (value) => ({ type: SET_TRADE, value }),
  setProvince:          (value) => ({ type: SET_PROVINCE, value }),
  setCountry:           (value) => ({ type: SET_COUNTRY, value }),
  setPhoto:             (value) => ({ type: SET_PHOTO, value }),
  setListening:         (value) => ({ type: SET_LISTENING, value }),
  setPhotoSaved:        (value) => ({ type: SET_PHOTO_SAVED, value }),
  setSuggestions:       (value) => ({ type: SET_SUGGESTIONS, value }),
  setScopeLoading:      (value) => ({ type: SET_SCOPE_LOADING, value }),
  setScopeLoadingMsg:   (value) => ({ type: SET_SCOPE_LOADING_MSG, value }),
  setScopeError:        (value) => ({ type: SET_SCOPE_ERROR, value }),
  setExpandedSug:       (value) => ({ type: SET_EXPANDED_SUG, value }),
  setScopeGaps:         (value) => ({ type: SET_SCOPE_GAPS, value }),
  setScopeMeta:         (value) => ({ type: SET_SCOPE_META, value }),
  dismissSuggestion:    (id) => ({ type: DISMISS_SUGGESTION, id }),
  setLineItems:         (value, markDirty = true) => ({ type: SET_LINE_ITEMS, value, markDirty }),
  updateItem:           (id, changes) => ({ type: UPDATE_ITEM, id, changes }),
  removeItem:           (id) => ({ type: REMOVE_ITEM, id }),
  addItem:              (item) => ({ type: ADD_ITEM, item }),
  reorderItems:         (from, to) => ({ type: REORDER_ITEMS, from, to }),
  updateDraft:          (key, value) => ({ type: UPDATE_DRAFT, key, value }),
  setDraft:             (value) => ({ type: SET_DRAFT, value }),
  setCustomerSearch:    (value) => ({ type: SET_CUSTOMER_SEARCH, value }),
  setShowNewCust:       (value) => ({ type: SET_SHOW_NEW_CUST, value }),
  setNewCust:           (value) => ({ type: SET_NEW_CUST, value }),
  setAddMode:           (value) => ({ type: SET_ADD_MODE, value }),
  setCatalogQuery:      (value) => ({ type: SET_CATALOG_QUERY, value }),
  setCatalogResults:    (value) => ({ type: SET_CATALOG_RESULTS, value }),
  setEditingItem:       (value) => ({ type: SET_EDITING_ITEM, value }),
  setShowDetails:       (value) => ({ type: SET_SHOW_DETAILS, value }),
  setInlinePhone:       (value) => ({ type: SET_INLINE_PHONE, value }),
  setCompanyName:       (value) => ({ type: SET_COMPANY_NAME, value }),
  markItemLeaving:      (id) => ({ type: MARK_ITEM_LEAVING, id }),
  clearItemLeaving:     (id) => ({ type: CLEAR_ITEM_LEAVING, id }),
  setDeliveryMethod:    (value) => ({ type: SET_DELIVERY_METHOD, value }),
  setSmsBody:           (value) => ({ type: SET_SMS_BODY, value }),
  setInitialSmsTemplate:(value) => ({ type: SET_INITIAL_SMS_TEMPLATE, value }),
  setShowSend:          (value) => ({ type: SET_SHOW_SEND, value }),
  setSmsConfirmPending: (value) => ({ type: SET_SMS_CONFIRM_PENDING, value }),
  setSentSuccess:       (value) => ({ type: SET_SENT_SUCCESS, value }),
  setQuoteId:           (value) => ({ type: SET_QUOTE_ID, value }),
  setSaving:            (value) => ({ type: SET_SAVING, value }),
  setSending:           (value) => ({ type: SET_SENDING, value }),
  setError:             (value) => ({ type: SET_ERROR, value }),
  setSaveState:         (value) => ({ type: SET_SAVE_STATE, value }),
  setLastSavedAt:       (value) => ({ type: SET_LAST_SAVED_AT, value }),
  setUserProfile:       (value) => ({ type: SET_USER_PROFILE, value }),
  setSentThisMonth:     (value) => ({ type: SET_SENT_THIS_MONTH, value }),
  setIsLocked:          (value) => ({ type: SET_IS_LOCKED, value }),
  setShowUpgradeModal:  (value) => ({ type: SET_SHOW_UPGRADE_MODAL, value }),
  setZeroItemConfirm:   (value) => ({ type: SET_ZERO_ITEM_CONFIRM, value }),
  setOfflineDraft:      (value) => ({ type: SET_OFFLINE_DRAFT, value }),
  markDirty:            () => ({ type: MARK_DIRTY }),
  clearDirty:           () => ({ type: CLEAR_DIRTY }),
  setShowKbdHelp:       (value) => ({ type: SET_SHOW_KBD_HELP, value }),
  batch:                (...acts) => ({ type: BATCH, actions: acts }),
  resetForNewQuote:     () => ({ type: RESET_FOR_NEW_QUOTE }),
};
