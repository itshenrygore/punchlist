const PROVINCE_TAX = {
  AB: 0.05, BC: 0.12, MB: 0.12, NB: 0.15, NL: 0.15,
  NS: 0.15, ON: 0.13, PE: 0.15, QC: 0.14975, SK: 0.11,
  NT: 0.05, NU: 0.05, YT: 0.05,
};

const US_STATE_TAX = {
  AL: 0.04, AK: 0, AZ: 0.056, AR: 0.065, CA: 0.0725,
  CO: 0.029, CT: 0.0635, DE: 0, FL: 0.06, GA: 0.04,
  HI: 0.04, ID: 0.06, IL: 0.0625, IN: 0.07, IA: 0.06,
  KS: 0.065, KY: 0.06, LA: 0.0445, ME: 0.055, MD: 0.06,
  MA: 0.0625, MI: 0.06, MN: 0.06875, MS: 0.07, MO: 0.04225,
  MT: 0, NE: 0.055, NV: 0.0685, NH: 0, NJ: 0.06625,
  NM: 0.05125, NY: 0.04, NC: 0.0475, ND: 0.05, OH: 0.0575,
  OK: 0.045, OR: 0, PA: 0.06, RI: 0.07, SC: 0.06,
  SD: 0.042, TN: 0.07, TX: 0.0625, UT: 0.0485, VT: 0.06,
  VA: 0.043, WA: 0.065, WV: 0.06, WI: 0.05, WY: 0.04, DC: 0.06,
};

export const CA_PROVINCES = ['AB','BC','MB','NB','NL','NS','ON','PE','QC','SK','NT','NU','YT'];
export const US_STATES = ['AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'];

export const REGION_LABELS = {
  CA: { regionLabel: 'Province', regions: CA_PROVINCES, currency: 'CAD', currencySymbol: '$', locale: 'en-CA' },
  US: { regionLabel: 'State', regions: US_STATES, currency: 'USD', currencySymbol: '$', locale: 'en-US' },
};

export function regionTaxRate(region, country = 'CA') {
  if (country === 'US') return US_STATE_TAX[region] || 0;
  return PROVINCE_TAX[region] || 0.13;
}

// Legacy alias
export function provinceTaxRate(province) {
  return regionTaxRate(province, 'CA');
}

export function calculateTotals(items, region = 'ON', country = 'CA') {
  const subtotal = items.reduce((sum, item) => {
    if (item.included === false) return sum;
    return sum + Number(item.quantity || 0) * Number(item.unit_price || 0);
  }, 0);
  const rate = regionTaxRate(region, country);
  const tax = subtotal * rate;
  return { subtotal, tax, total: subtotal + tax, rate };
}

function marketSignal(items = []) {
  const comparable = items.filter(i => i.included !== false && (i.typical_range_low || i.typical_range_high));
  if (!comparable.length) return null;
  let low = 0, high = 0, actual = 0;
  comparable.forEach(item => {
    const qty = Number(item.quantity || 1);
    low    += Number(item.typical_range_low  || item.unit_price || 0) * qty;
    high   += Number(item.typical_range_high || item.unit_price || 0) * qty;
    actual += Number(item.unit_price || 0) * qty;
  });
  if (actual < low  * 0.9) return 'below';
  if (actual > high * 1.1) return 'above';
  return 'healthy';
}

/**
 * buildConfidence — returns structured scope/pricing/risk/readiness checks
 * Used in both the quote builder confidence module and the quote detail sidebar
 */
export function buildConfidence(items, warnings, { hasCustomer, hasScope, hasDeposit, revisionSummary } = {}) {
  const includedItems = items.filter(i => i.included !== false);
  const pricedItems   = includedItems.filter(i => Number(i.unit_price || 0) > 0);
  const signal        = marketSignal(items);

  // ── Scope checks ──
  const scopeIssues = [];
  const scopeGood   = [];

  if (!includedItems.length) {
    scopeIssues.push({ id:'no_items', text: 'No scope items added yet', action: 'add_items' });
  } else {
    scopeGood.push(`${includedItems.length} item${includedItems.length>1?'s':''} in scope`);
  }

  const hasCleanup = includedItems.some(i => /cleanup|disposal|haul|site protection|protection/i.test(i.name||''));
  if (!hasCleanup && includedItems.length > 0) {
    scopeIssues.push({ id:'no_cleanup', text: 'Cleanup or disposal not listed', action: 'add_item' });
  }

  const hasMaterials = includedItems.some(i => /material|part|supply|connector|fitting|hardware/i.test(i.name||''));
  if (!hasMaterials && includedItems.length > 0) {
    scopeIssues.push({ id:'no_materials', text: 'Materials or parts not listed', action: 'add_item' });
  }

  const hasOptional = items.some(i => ['optional','recommended'].includes(i.item_type));
  if (!hasOptional && includedItems.length > 2) {
    scopeIssues.push({ id:'no_optional', text: 'No optional items offered', action: 'add_optional' });
  }

  // ── Pricing checks ──
  const pricingIssues = [];
  const pricingGood   = [];

  if (includedItems.length && !pricedItems.length) {
    pricingIssues.push({ id:'no_prices', text: 'No items have a price yet', action: 'add_prices' });
  } else if (signal === 'below') {
    pricingIssues.push({ id:'price_low', text: 'Total looks below typical range for this job', action: 'review_prices' });
  } else if (signal === 'above') {
    pricingIssues.push({ id:'price_high', text: 'Total is above typical range — add context', action: 'review_prices' });
  } else if (signal === 'healthy') {
    pricingGood.push('Pricing within expected range');
  }

  // ── Risk / readiness checks ──
  const riskIssues  = [];
  const riskGood    = [];

  if (!hasCustomer) {
    riskIssues.push({ id:'no_customer', text: 'No customer linked', action: 'add_customer' });
  } else {
    riskGood.push('Customer linked');
  }

  if (!hasScope && includedItems.length > 0) {
    // soft — not penalized, just noted
    riskIssues.push({ id:'no_scope', text: 'Scope summary not added (optional)', action: 'add_scope', soft: true });
  }

  (warnings || []).slice(0,2).forEach(w => {
    riskIssues.push({ id:'warn_'+w.slice(0,10), text: w, action: null });
  });

  // ── Score ──
  let score = 100;
  score -= scopeIssues.filter(i=>!i.soft).length   * 10;
  score -= pricingIssues.filter(i=>!i.soft).length * 12;
  score -= riskIssues.filter(i=>!i.soft).length    * 12;
  if (!includedItems.length) score = Math.min(score, 40);
  score = Math.max(25, Math.min(100, Math.round(score)));

  // ── Readiness ──
  const hardIssues = [...scopeIssues, ...pricingIssues, ...riskIssues].filter(i=>!i.soft);
  const readiness = hardIssues.length === 0 ? 'ready'
    : hardIssues.length <= 1 ? 'review'
    : 'attention';

  // Legacy checks array for confidence-panel compatibility
  const checks = [
    ...(includedItems.length
      ? [{ label: `${includedItems.length} scope items`, state:'good' }]
      : [{ label: 'No scope items yet', state:'warn' }]),
    ...(hasCustomer ? [{ label:'Customer linked', state:'good' }] : [{ label:'No customer', state:'warn' }]),
    ...(signal==='healthy' ? [{ label:'Pricing in range', state:'good' }] : signal==='below' ? [{ label:'Pricing may be low', state:'warn' }] : []),
    ...(hasCleanup ? [{ label:'Cleanup included', state:'good' }] : includedItems.length ? [{ label:'Cleanup not listed', state:'warn' }] : []),
    ...(hasOptional ? [{ label:'Options offered', state:'good' }] : []),
    ...(hasScope ? [{ label:'Scope summary added', state:'good' }] : []),
    ...(revisionSummary ? [{ label:'Revision notes ready', state:'good' }] : []),
  ].slice(0,6);

  return {
    score,
    readiness,
    scopeIssues,  scopeGood,
    pricingIssues,pricingGood,
    riskIssues,   riskGood,
    marketSignal: signal,
    checks,
  };
}
