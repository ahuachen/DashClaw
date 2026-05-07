import { Inter } from 'next/font/google'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale, getMessages } from 'next-intl/server'
import './globals.css'
import SessionWrapper from './components/SessionWrapper'
import { Analytics } from '@vercel/analytics/next'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata = {
  title: 'DashClaw — Decision Infrastructure for AI Agents',
  description: 'The governance control plane for AI agent fleets. Enforce policies, require human approval, and record verifiable evidence. Open source, self-hosted, MIT licensed.',
  icons: {
    icon: [
      { url: '/favicons/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicons/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: '/favicons/apple-touch-icon.png',
  },
  manifest: '/config/site.webmanifest',
  openGraph: {
    title: 'DashClaw — Decision Infrastructure for AI Agents',
    description: 'The governance control plane for AI agent fleets. Enforce policies, require human approval, and record verifiable evidence. Open source, self-hosted, MIT licensed.',
    url: 'https://dashclaw.io',
    siteName: 'DashClaw',
    type: 'website',
    images: [
      {
        url: '/social/og-image.png',
        width: 1200,
        height: 630,
        alt: 'DashClaw governance control plane for AI agents',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DashClaw — Decision Infrastructure for AI Agents',
    description: 'The governance control plane for AI agent fleets. Open source, self-hosted, MIT licensed.',
    images: ['/social/twitter-card.png'],
  },
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0a0a0a',
}

export default async function RootLayout({ children }) {
  const enableAnalytics =
    // Vercel sets this in deployments; keeps self-host/non-Vercel installs from emitting analytics by default.
    process.env.VERCEL === '1' ||
    // Explicit opt-in for non-Vercel hosts.
    process.env.NEXT_PUBLIC_ENABLE_VERCEL_ANALYTICS === 'true'

  // Locale is resolved by `i18n/request.js` from the `x-locale` header that
  // middleware.js sets when the URL starts with `/zh-CN/`. Falls back to
  // `en` for non-prefixed paths.
  const locale = await getLocale()
  const messages = await getMessages()

  return (
    <html lang={locale} className={inter.variable}>
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="theme-color" content="#0a0a0a" />
      </head>
      <body className="font-sans antialiased">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <SessionWrapper>{children}</SessionWrapper>
        </NextIntlClientProvider>
        {enableAnalytics ? <Analytics /> : null}
      </body>
    </html>
  )
}
