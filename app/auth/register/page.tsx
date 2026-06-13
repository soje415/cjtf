import Image from 'next/image'
import Link from 'next/link'
import RegisterForm from './RegisterForm'

export default function RegisterPage({ searchParams }: { searchParams: { error?: string } }) {
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
            <h1 className="text-xl font-bold text-gray-800">Create Applicant Account</h1>
            <p className="text-xs text-gray-500 mt-1">Register to begin your CJTF recruitment application</p>
          </div>

          <div className="p-8 pt-4">
            {searchParams.error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3 mb-4">
                {searchParams.error}
              </div>
            )}

            <RegisterForm />

            <p className="text-center text-sm text-gray-500 mt-4">
              Already registered?{' '}
              <Link href="/auth/login" className="text-cjtf-blue font-medium hover:underline">
                Sign in here
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
