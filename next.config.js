/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  productionBrowserSourceMaps: false,
  env: {
    NEXT_PUBLIC_DASHCLAW_VERSION: require('./package.json').version,
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'avatars.githubusercontent.com' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: 'api.dicebear.com' },
    ],
  },
  // Security headers
  async headers() {
    const csp = [
      "default-src 'self'",
      // In dev mode, Next.js needs 'unsafe-eval' for hot reloading
      `script-src 'self' 'unsafe-inline' ${process.env.NODE_ENV === 'development' ? "'unsafe-eval'" : ''}`,
      // Disallow inline event handlers like onclick="..."
      "script-src-attr 'none'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://avatars.githubusercontent.com https://lh3.googleusercontent.com https://api.dicebear.com",
      "font-src 'self' data:",
      "connect-src 'self' https://*.neon.tech https://github.com https://accounts.google.com https://checkout.stripe.com https://billing.stripe.com",
      "base-uri 'none'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      'upgrade-insecure-requests',
      'block-all-mixed-content',
    ].join('; ');

    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          {
            key: 'Content-Security-Policy',
            value: csp,
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
        ],
      },
    ];
  },
  // API Rewrites for backward compatibility with older SDKs
  async rewrites() {
    return [
      { source: '/api/actions/:actionId/approve', destination: '/api/approvals/:actionId' },
      { source: '/api/actions/assumptions', destination: '/api/assumptions' },
      { source: '/api/actions/assumptions/:assumptionId', destination: '/api/assumptions/:assumptionId' },
      { source: '/api/actions/signals', destination: '/api/signals' },
    ];
  },
}

module.exports = nextConfig
