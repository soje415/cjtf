'use client'

import { useState } from 'react'

export default function RegisterForm({ next }: { next?: string }) {
  const [loading, setLoading] = useState(false)

  return (
    <form
      action="/api/auth/register"
      method="POST"
      onSubmit={() => setLoading(true)}
      className="space-y-3"
    >
      {next && <input type="hidden" name="next" value={next} />}
      <div className="space-y-1">
        <label htmlFor="fullName" className="text-sm font-medium text-gray-700">Full Name</label>
        <input id="fullName" name="fullName" type="text" required placeholder="John Doe"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cjtf-blue" />
      </div>
      <div className="space-y-1">
        <label htmlFor="phone" className="text-sm font-medium text-gray-700">Phone Number</label>
        <input id="phone" name="phone" type="tel" required placeholder="0801 234 5678"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cjtf-blue" />
      </div>
      <div className="space-y-1">
        <label htmlFor="email" className="text-sm font-medium text-gray-700">Email Address</label>
        <input id="email" name="email" type="email" required placeholder="you@example.com"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cjtf-blue" />
      </div>
      <div className="space-y-1">
        <label htmlFor="password" className="text-sm font-medium text-gray-700">Password</label>
        <input id="password" name="password" type="password" required placeholder="Min. 8 characters"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cjtf-blue" />
      </div>
      <div className="space-y-1">
        <label htmlFor="confirm" className="text-sm font-medium text-gray-700">Confirm Password</label>
        <input id="confirm" name="confirm" type="password" required placeholder="Repeat password"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cjtf-blue" />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-cjtf-blue hover:bg-cjtf-blue-dark disabled:opacity-60 text-white font-semibold py-2 px-4 rounded-lg text-sm transition-colors"
      >
        {loading ? 'Creating account…' : 'Register & Apply'}
      </button>
    </form>
  )
}
