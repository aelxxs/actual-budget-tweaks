let currencyCode = 'USD';
let currencyScale = 100;

// ── Currency formatting ───────────────────────────────────────────────
export function configureCurrency(code) {
  if (!code || typeof code !== 'string') return;
  currencyCode = code;
  try {
    const opts = new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: code,
    }).resolvedOptions();
    const digits = Number.isFinite(opts.maximumFractionDigits)
      ? opts.maximumFractionDigits
      : 2;
    currencyScale = Math.pow(10, digits);
  } catch {
    currencyCode = 'USD';
    currencyScale = 100;
  }
}

export async function loadCurrencyPreference() {
  try {
    const res = await window.$query(
      window.$q('preferences')
        .filter({ id: 'defaultCurrencyCode' })
        .select('*')
    );
    const row = res && res.data && res.data[0];
    configureCurrency(row && row.value);
  } catch {
    configureCurrency('USD');
  }
}

export function fmtMoney(cents, opts) {
  const sign = opts && opts.sign;
  const n = (cents || 0) / currencyScale;
  const abs = Math.abs(n);
  const str = new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: Math.round(currencyScale) === 1 ? 0 : undefined,
    maximumFractionDigits: Math.round(currencyScale) === 1 ? 0 : undefined,
  }).format(abs);
  if (sign && cents > 0) return '+' + str;
  if (n < 0) return '−' + str;
  return str;
}

export function amountToCents(amount) {
  if (!Number.isFinite(amount)) return 0;
  return Math.max(0, Math.round(amount * currencyScale));
}
