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
  const {
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

  try {
    let minDigits = options.minimumFractionDigits !== undefined && Number.isFinite(options.minimumFractionDigits)
      ? Math.floor(options.minimumFractionDigits)
      : 2;
    let maxDigits = options.maximumFractionDigits !== undefined && Number.isFinite(options.maximumFractionDigits)
      ? Math.floor(options.maximumFractionDigits)
      : 2;

    minDigits = Math.max(0, Math.min(20, minDigits));
    maxDigits = Math.max(0, Math.min(20, maxDigits));

    if (options.maximumFractionDigits !== undefined && options.minimumFractionDigits === undefined) {
      minDigits = Math.min(minDigits, maxDigits);
    }
    if (minDigits > maxDigits) {
      minDigits = maxDigits;
    }

    const formatted = amount.toLocaleString('en-IN', {
      minimumFractionDigits: minDigits,
      maximumFractionDigits: maxDigits,
    });

    return currencyPrefix ? `₹${formatted}` : formatted;
  } catch {
    try {
      const fallbackDigits = Math.max(0, Math.min(20, options.maximumFractionDigits ?? 2));
      return currencyPrefix ? `₹${amount.toFixed(fallbackDigits)}` : amount.toFixed(fallbackDigits);
    } catch {
      return currencyPrefix ? `₹${amount}` : String(amount);
    }
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

