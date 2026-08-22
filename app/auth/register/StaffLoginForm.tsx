'use client'

import { useState } from 'react'

export default function StaffLoginForm({ mode }: { mode: 'applicant' | 'office' }) {
  const [loading, setLoading] = useState(false)

  return (
    <form
      action="/api/auth/staff-login"
      method="POST"
      onSubmit={() => setLoading(true)}
      className="space-y-3"
    >
      <input type="hidden" name="mode" value={mode} />
      <div className="space-y-1">
        <label htmlFor="email" className="text-sm font-medium text-gray-700">Staff Email</label>
        <input id="email" name="email" type="email" required placeholder="admin@cjtf.gov.ng"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cjtf-blue" />
      </div>
      <div className="space-y-1">
        <label htmlFor="password" className="text-sm font-medium text-gray-700">Password</label>
        <input id="password" name="password" type="password" required placeholder="••••••••"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cjtf-blue" />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-cjtf-blue hover:bg-cjtf-blue-dark disabled:opacity-60 text-white font-semibold py-2 px-4 rounded-lg text-sm transition-colors"
      >
        {loading ? 'Authorizing…' : 'Authorize (Staff only)'}
      </button>
    </form>
  )
}
