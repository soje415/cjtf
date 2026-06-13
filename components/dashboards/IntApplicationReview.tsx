'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Application, ApplicationNote } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { STATUS_LABELS, STATUS_COLORS } from '@/lib/types'
import { toast } from 'sonner'

interface Props {
  application: Application
  notes: (ApplicationNote & { profiles?: { full_name: string; role: string } })[]
}

export default function IntApplicationReview({ application, notes }: Props) {
  const router = useRouter()
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState<'clear' | 'reject' | null>(null)

  async function handleAction(action: 'clear' | 'reject') {
    if (!note.trim()) {
      toast.error('Please add a screening note before proceeding')
      return
    }
    setLoading(action)
    const endpoint = action === 'clear' ? 'intel-forward' : 'reject'
    const res = await fetch(`/api/applications/${application.id}/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note }),
    })
    if (res.ok) {
      toast.success(action === 'clear' ? 'Application cleared — forwarded to Admin' : 'Application rejected')
      router.push('/portal/int/dashboard')
    } else {
      const d = await res.json()
      toast.error(d.error || 'Action failed')
    }
    setLoading(null)
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">{application.first_name} {application.last_name}</h1>
          <p className="text-sm text-gray-500">Intelligence Screening</p>
        </div>
        <Badge className={STATUS_COLORS[application.status]}>{STATUS_LABELS[application.status]}</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {application.passport_photo_url && (
          <Card>
            <CardContent className="p-4 text-center">
              <Image src={application.passport_photo_url} alt="Passport" width={120} height={140} className="mx-auto rounded object-cover" />
              <p className="text-xs text-gray-500 mt-2">Passport Photo</p>
            </CardContent>
          </Card>
        )}
        <Card className="md:col-span-2">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Applicant Details</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-2 text-sm">
            {[
              ['Full Name', `${application.first_name} ${application.middle_name ?? ''} ${application.last_name}`],
              ['Date of Birth', application.date_of_birth ?? '—'],
              ['Gender', application.gender ?? '—'],
              ['NIN', application.nin || '—'],
              ['State', application.state_of_origin],
              ['LGA', application.lga_of_origin],
              ['Phone', application.phone_number],
              ['Address', application.residential_address],
            ].map(([label, value]) => (
              <div key={label}>
                <p className="text-gray-500 text-xs">{label}</p>
                <p className="font-medium">{value}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Next of Kin</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-3 gap-3 text-sm">
          {[
            ['Name', application.next_of_kin_name],
            ['Phone', application.next_of_kin_phone],
            ['Relationship', application.next_of_kin_relationship],
          ].map(([label, value]) => (
            <div key={label}>
              <p className="text-gray-500 text-xs">{label}</p>
              <p className="font-medium">{value}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Documents</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          {application.id_document_url && (
            <a href={application.id_document_url} target="_blank" rel="noopener noreferrer" className="text-sm text-cjtf-green underline">View ID Document</a>
          )}
          {application.birth_cert_url && (
            <a href={application.birth_cert_url} target="_blank" rel="noopener noreferrer" className="text-sm text-cjtf-green underline">View Birth Certificate</a>
          )}
        </CardContent>
      </Card>

      {notes.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Processing Notes</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {notes.map((n) => (
              <div key={n.id} className="text-sm border-l-2 border-purple-400 pl-3">
                <p className="font-medium text-gray-700">{n.note}</p>
                <p className="text-xs text-gray-400">{n.profiles?.full_name} ({n.profiles?.role}) — {new Date(n.created_at).toLocaleString('en-NG')}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Separator />

      <div className="space-y-3">
        <div className="space-y-1">
          <Label>Screening Note * (required)</Label>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Provide your intelligence screening assessment…"
            rows={3}
          />
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => router.back()}>Back</Button>
          <Button
            onClick={() => handleAction('reject')}
            disabled={!!loading}
            variant="destructive"
          >
            {loading === 'reject' ? 'Rejecting…' : 'Reject Application'}
          </Button>
          <Button
            onClick={() => handleAction('clear')}
            disabled={!!loading}
            className="bg-purple-600 hover:bg-purple-700 text-white"
          >
            {loading === 'clear' ? 'Forwarding…' : 'Clear & Forward to Admin →'}
          </Button>
        </div>
      </div>
    </div>
  )
}
