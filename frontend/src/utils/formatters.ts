/**
 * Safe formatting utilities for PAYFLOW — Corporate HRMS & Payroll
 * Protects against undefined/null rendering exceptions while preserving locale and currency precision.
 */

export interface FormatAmountOptions {
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  fallback?: string;
  currencyPrefix?: boolean;
}

/**
 * Formats a monetary number or valid numeric string into standard Indian locale (en-IN).
 * Explicitly handles null, undefined, empty string, and non-finite values safely without throwing.
 */
export function formatAmount(
  value: number | string | null | undefined,
  options: FormatAmountOptions = {}
): string {
  let {
    minimumFractionDigits = 2,
    maximumFractionDigits = 2,
    fallback = '—',
    currencyPrefix = false
  } = options;

  if (value === null || value === undefined || value === '') {
    return fallback;
  }

  const amount = typeof value === 'number' ? value : Number(value);

  if (!Number.isFinite(amount)) {
    return fallback;
  }

  // In Intl.NumberFormat, minimumFractionDigits must be <= maximumFractionDigits.
  // If the caller provided maximumFractionDigits without specifying minimumFractionDigits,
  // clamp minimumFractionDigits to maximumFractionDigits.
  if (options.maximumFractionDigits !== undefined && options.minimumFractionDigits === undefined) {
    minimumFractionDigits = Math.min(minimumFractionDigits, options.maximumFractionDigits);
  }
  if (minimumFractionDigits > maximumFractionDigits) {
    minimumFractionDigits = maximumFractionDigits;
  }

  try {
    const formatted = amount.toLocaleString('en-IN', {
      minimumFractionDigits,
      maximumFractionDigits,
    });

    return currencyPrefix ? `₹${formatted}` : formatted;
  } catch {
    const safeDigits = Math.max(0, Math.min(20, maximumFractionDigits));
    return currencyPrefix ? `₹${amount.toFixed(safeDigits)}` : amount.toFixed(safeDigits);
  }
}

/**
 * Formats a monetary value with the standard ₹ currency prefix.
 */
export function formatCurrency(
  value: number | string | null | undefined,
  options: Omit<FormatAmountOptions, 'currencyPrefix'> = {}
): string {
  return formatAmount(value, { ...options, currencyPrefix: true });
}

/**
 * Formats integer counts, days, or headcounts with fallback.
 */
export function formatInteger(
  value: number | string | null | undefined,
  fallback: string = '0'
): string {
  return formatAmount(value, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
    fallback,
    currencyPrefix: false
  });
}

/**
 * Formats percentage rates (e.g. interest rates, tax rates).
 */
export function formatPercentage(
  value: number | string | null | undefined,
  fallback: string = '—'
): string {
  if (value === null || value === undefined || value === '') return fallback;
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) return fallback;
  try {
    return `${num.toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}%`;
  } catch {
    return `${num.toFixed(2)}%`;
  }
}

