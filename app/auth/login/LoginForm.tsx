'use client'

import { useState } from 'react'

export default function LoginForm({ accentColor = '#09ADE2', next, role }: { accentColor?: string; next?: string; role?: string }) {
  const [loading, setLoading] = useState(false)

  return (
    <form
      action="/api/auth/login"
      method="POST"
      onSubmit={() => setLoading(true)}
      className="space-y-4"
    >
      {next && <input type="hidden" name="next" value={next} />}
      {role && <input type="hidden" name="role" value={role} />}
      <div className="space-y-1">
        <label htmlFor="email" className="text-sm font-medium text-gray-700">Email Address</label>
        <input
          id="email"
          name="email"
          type="email"
          required
          placeholder="you@example.com"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:border-transparent transition-shadow"
        />
      </div>
      <div className="space-y-1">
        <label htmlFor="password" className="text-sm font-medium text-gray-700">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          required
          placeholder="••••••••"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:border-transparent transition-shadow"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full text-white font-semibold py-2 px-4 rounded-lg text-sm transition-opacity disabled:opacity-60"
        style={{ background: accentColor }}
      >
        {loading ? 'Signing in…' : 'Sign In'}
      </button>
    </form>
  )
}
