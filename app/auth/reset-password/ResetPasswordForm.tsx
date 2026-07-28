'use client'

import { useState } from 'react'

export default function ResetPasswordForm() {
  const [loading, setLoading] = useState(false)
  const [mismatch, setMismatch] = useState(false)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    const form = e.currentTarget
    const password = (form.elements.namedItem('password') as HTMLInputElement).value
    const confirm = (form.elements.namedItem('confirm') as HTMLInputElement).value
    if (password !== confirm) {
      e.preventDefault()
      setMismatch(true)
      return
    }
    setMismatch(false)
    setLoading(true)
  }

  return (
    <form action="/api/auth/reset-password" method="POST" onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-1">
        <label htmlFor="password" className="text-sm font-medium text-gray-700">New Password</label>
        <input id="password" name="password" type="password" required minLength={8} placeholder="Min. 8 characters"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cjtf-blue" />
      </div>
      <div className="space-y-1">
        <label htmlFor="confirm" className="text-sm font-medium text-gray-700">Confirm New Password</label>
        <input id="confirm" name="confirm" type="password" required minLength={8} placeholder="Repeat password"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cjtf-blue" />
      </div>
      {mismatch && <p className="text-sm text-red-600">Passwords don&apos;t match.</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-cjtf-blue hover:bg-cjtf-blue-dark disabled:opacity-60 text-white font-semibold py-2 px-4 rounded-lg text-sm transition-colors"
      >
        {loading ? 'Updating…' : 'Update Password'}
      </button>
    </form>
  )
}
