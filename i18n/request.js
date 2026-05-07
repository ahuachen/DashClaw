/**
 * next-intl request configuration.
 *
 * Locale resolution order (set by middleware.js):
 *   1. `x-locale` request header (injected for /zh-CN/... rewrites)
 *   2. `NEXT_LOCALE` cookie (persisted from previous prefixed visit)
 *   3. fallback to `en`
 *
 * We deliberately do NOT use next-intl's bundled middleware — the existing
 * middleware.js owns auth/demo/CORS and is too large to compose with
 * next-intl's middleware. Instead a tiny prefix detector runs at the top of
 * middleware.js and signals the resolved locale via header + cookie.
 *
 * See docs/i18n/strategy.md §3 (plan E) for context.
 */

import { getRequestConfig } from 'next-intl/server';
import { headers, cookies } from 'next/headers';

export const SUPPORTED_LOCALES = /** @type {const} */ (['en', 'zh-CN']);
export const DEFAULT_LOCALE = 'en';

function isSupported(locale) {
  return SUPPORTED_LOCALES.includes(locale);
}

export default getRequestConfig(async () => {
  const reqHeaders = await headers();
  const cookieStore = await cookies();

  const fromHeader = reqHeaders.get('x-locale');
  const fromCookie = cookieStore.get('NEXT_LOCALE')?.value;

  const locale =
    (isSupported(fromHeader) && fromHeader) ||
    (isSupported(fromCookie) && fromCookie) ||
    DEFAULT_LOCALE;

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
