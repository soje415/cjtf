import Image from 'next/image'
import Link from 'next/link'

export default function ForgotPasswordPage({ searchParams }: { searchParams: { sent?: string } }) {
  const sent = searchParams.sent === '1'

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(135deg, #09ADE2 0%, #0790BC 100%)' }}>
      <div className="h-2 flex">
        <div className="flex-1 bg-cjtf-blue" />
        <div className="flex-1 bg-cjtf-yellow" />
        <div className="flex-1 bg-cjtf-red" />
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm bg-white rounded-xl shadow-2xl overflow-hidden">
          <div className="p-8 pb-2 text-center">
            <div className="flex justify-center mb-4">
              <Image
                src="/cjtf-logo.jpg"
                alt="CJTF Nigeria Logo"
                width={80}
                height={80}
                className="rounded-full border-4 border-cjtf-yellow shadow-lg"
              />
            </div>
            <h1 className="text-xl font-bold text-gray-800">Reset your password</h1>
            <p className="text-xs text-gray-500 mt-1">
              {sent
                ? "If that email is registered, we've sent a reset link to it."
                : "Enter the email on your account and we'll send you a reset link."}
            </p>
          </div>

          <div className="p-8 pt-4">
            {sent ? (
              <p className="text-sm text-gray-600 text-center">
                Check your inbox (and spam folder). The link expires after a short time — request a new one
                below if it doesn&apos;t arrive.
              </p>
            ) : (
              <form action="/api/auth/forgot-password" method="POST" className="space-y-3">
                <div className="space-y-1">
                  <label htmlFor="email" className="text-sm font-medium text-gray-700">Email Address</label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    placeholder="you@example.com"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cjtf-blue"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full bg-cjtf-blue hover:bg-cjtf-blue-dark text-white font-semibold py-2 px-4 rounded-lg text-sm transition-colors"
                >
                  Send reset link
                </button>
              </form>
            )}

            <p className="text-center text-sm text-gray-500 mt-4">
              <Link href="/auth/login" className="text-cjtf-blue font-medium hover:underline">
                ← Back to sign in
              </Link>
            </p>
          </div>
        </div>
      </div>

      <div className="text-center pb-4 text-xs text-white/70">
        Civilian Joint Task Force Nigeria — Official Recruitment System
      </div>
    </div>
  )
}
