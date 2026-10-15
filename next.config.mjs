import { withPayload } from '@payloadcms/next/withPayload'
export default withPayload({
  output: 'standalone',
  skipTrailingSlashRedirect: true,
  poweredByHeader: false,
  experimental: { cpus: 2 },
  images: { remotePatterns: [] },
  async headers() { return [{ source: '/:path*', headers: [
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  ] }] },
})
