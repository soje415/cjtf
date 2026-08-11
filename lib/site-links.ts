// The public marketing site (separate Astro app) is the single front door: all
// discovery — recruitment and office registration alike — starts there, and the
// portal only handles the logged-in work. Override with NEXT_PUBLIC_WEBSITE_URL
// when the site moves to its own domain.
export const WEBSITE_URL =
  process.env.NEXT_PUBLIC_WEBSITE_URL || 'https://cjtf-national-website.pages.dev'
