'use client'

import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { formatNaira, REGISTRATION_FEE_KOBO, LEGACY_REGISTRATION_FEE_KOBO } from '@/lib/fees'

export default function MembershipTypeChoice() {
  const router = useRouter()

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">CJTF Application</h1>
        <p className="text-gray-500 text-sm mt-1">Tell us which best describes you before we start.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card
          role="button"
          onClick={() => router.push('/portal/applicant/application?type=new')}
          className="cursor-pointer hover:border-cjtf-green transition-colors"
        >
          <CardContent className="p-6 space-y-2">
            <p className="font-semibold text-gray-800">New Recruit</p>
            <p className="text-sm text-gray-500">
              I am not currently a CJTF member and want to apply for the first time.
            </p>
            <p className="text-sm font-medium text-cjtf-green">{formatNaira(REGISTRATION_FEE_KOBO)} registration fee</p>
          </CardContent>
        </Card>

        <Card
          role="button"
          onClick={() => router.push('/portal/applicant/application?type=legacy')}
          className="cursor-pointer hover:border-cjtf-green transition-colors"
        >
          <CardContent className="p-6 space-y-2">
            <p className="font-semibold text-gray-800">Existing / Legacy Member</p>
            <p className="text-sm text-gray-500">
              I already serve as a CJTF member but am not yet on the portal — I need to be captured and issued a card.
            </p>
            <p className="text-sm font-medium text-cjtf-green">{formatNaira(LEGACY_REGISTRATION_FEE_KOBO)} ID card fee</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
