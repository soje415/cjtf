// Kept in sync with lib/site-links.ts, which can't be imported here (this config
// is loaded outside the module graph that resolves the `@/` alias).
const WEBSITE_URL =
  process.env.NEXT_PUBLIC_WEBSITE_URL || 'https://cjtf-national-website.pages.dev'

/** @type {import('next').NextConfig} */
const nextConfig = {
  // The public site is the single front door, so the portal root hands visitors
  // back to it. This lives in config rather than a `redirect()` inside the page:
  // `/` is statically prerendered, and a server-component redirect to an external
  // URL there only renders Next's error-boundary shell with no Location header.
  // A config redirect is a real 307 issued before any rendering.
  async redirects() {
    return [{ source: '/', destination: WEBSITE_URL, permanent: false }]
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'uhbshtxafyhwigozyxkh.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
}

export default nextConfig
