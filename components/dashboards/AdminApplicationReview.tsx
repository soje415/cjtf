'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Application, Payment, ApplicationNote } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { STATUS_LABELS, STATUS_COLORS, MEMBERSHIP_TYPE_LABELS, MEMBERSHIP_TYPE_COLORS } from '@/lib/types'
import { CJTF_RANKS, DEFAULT_RECOMMENDED_RANK, type CjtfRank } from '@/lib/ranks'
import { toast } from 'sonner'

interface Props {
  application: Application
  payments: Payment[]
  notes: (ApplicationNote & { profiles?: { full_name: string; role: string } })[]
}

export default function AdminApplicationReview({ application, payments, notes }: Props) {
  const router = useRouter()
  const [note, setNote] = useState('')
  const isLegacy = application.membership_type === 'legacy'
  // Prefilled with INT's recommendation (legacy members also self-report a
  // rank, used only as a fallback) so approving is one click and overriding is
  // a deliberate act.
  const [rank, setRank] = useState<CjtfRank>(
    (application.cjtf_rank as CjtfRank | null)
      ?? (application.recommended_rank as CjtfRank | null)
      ?? ((isLegacy ? application.self_reported_rank : null) as CjtfRank | null)
      ?? DEFAULT_RECOMMENDED_RANK
  )
  const [loading, setLoading] = useState<'approve' | 'reject' | null>(null)
  const [waiveReason, setWaiveReason] = useState('')
  const [waiving, setWaiving] = useState(false)

  const isReview = application.status === 'PENDING_ADMIN_APPROVAL'

  async function handleWaive() {
    if (!waiveReason.trim()) { toast.error('Enter a reason to waive verification'); return }
    setWaiving(true)
    const res = await fetch(`/api/applications/${application.id}/waive-verification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: waiveReason }),
    })
    if (res.ok) {
      toast.success('Identity verification waived')
      router.refresh()
    } else {
      const d = await res.json()
      toast.error(d.error || 'Failed to waive')
    }
    setWaiving(false)
  }

  async function handleAction(action: 'approve' | 'reject') {
    if (!note.trim()) {
      toast.error('Please add a decision note before proceeding')
      return
    }
    if (action === 'approve' && !rank) {
      toast.error('Select the rank to assign before approving')
      return
    }
    setLoading(action)
    const endpoint = action === 'approve' ? 'approve' : 'reject'
    const res = await fetch(`/api/applications/${application.id}/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(action === 'approve' ? { note, rank } : { note }),
    })
    if (res.ok) {
      toast.success(action === 'approve' ? 'Applicant cleared! Sent to training.' : 'Application rejected.')
      router.push('/portal/admin/dashboard')
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
          <p className="text-sm text-gray-500">Admin Final Review</p>
        </div>
        <div className="flex gap-2">
          <Badge className={MEMBERSHIP_TYPE_COLORS[application.membership_type]}>
            {MEMBERSHIP_TYPE_LABELS[application.membership_type]}
          </Badge>
          <Badge className={STATUS_COLORS[application.status]}>{STATUS_LABELS[application.status]}</Badge>
        </div>
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
              ['Address', application.residential_address],
              ['Phone', application.phone_number],
              ['Email', application.email],
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
        <CardHeader className="pb-2"><CardTitle className="text-sm">Identity Verification</CardTitle></CardHeader>
        <CardContent className="text-sm space-y-2">
          {application.identity_verified ? (
            <p className="text-green-700 font-medium">
              ✓ Verified via {application.identity_verify_method?.toUpperCase()}
              {application.identity_verified_at && (
                <span className="text-gray-400 font-normal ml-2">
                  {new Date(application.identity_verified_at).toLocaleString('en-GB')}
                </span>
              )}
            </p>
          ) : application.identity_verify_waived ? (
            <p className="text-amber-700 font-medium">
              ⚠ Verification waived by staff
              {application.identity_verify_waived_reason && (
                <span className="text-gray-500 font-normal ml-2">— {application.identity_verify_waived_reason}</span>
              )}
            </p>
          ) : (
            <>
              <p className="text-red-600 font-medium">✗ Identity not verified (no NIN/BVN match on file)</p>
              {isReview && (
                <div className="flex gap-2 pt-1">
                  <Input
                    value={waiveReason}
                    onChange={(e) => setWaiveReason(e.target.value)}
                    placeholder="Reason to waive (e.g. no NIN/BVN, verified manually)"
                    className="flex-1"
                  />
                  <Button variant="outline" onClick={handleWaive} disabled={waiving}>
                    {waiving ? 'Waiving…' : 'Waive'}
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {isLegacy && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Existing Membership Claim</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-gray-500 text-xs">Self-Reported Rank</p>
                <p className="font-medium">{application.self_reported_rank || '—'}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs">Old CJTF ID / Rank Card No.</p>
                <p className="font-medium">{application.legacy_id_number || '—'}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs">Vouching Officer</p>
                <p className="font-medium">{application.vouching_officer_name || '—'}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs">Vouching Note</p>
                {application.vouching_doc_url ? (
                  <a href={application.vouching_doc_url} target="_blank" rel="noreferrer" className="font-medium text-cjtf-green underline">
                    View document
                  </a>
                ) : (
                  <p className="font-medium">Not provided</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {payments.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Payment Records</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {payments.map((p) => (
              <div key={p.id} className="flex justify-between text-sm">
                <span className="capitalize">{p.type.replace('_', ' ')} Fee</span>
                <span>₦{(p.amount / 100).toLocaleString()}</span>
                <Badge className={p.status === 'success' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}>{p.status}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {notes.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Full Processing Trail</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {notes.map((n) => (
              <div key={n.id} className={`text-sm border-l-2 pl-3 ${n.profiles?.role === 'ict' ? 'border-blue-400' : 'border-purple-400'}`}>
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
          <Label>Rank to Assign * (required to approve)</Label>
          <Select value={rank} onValueChange={(v) => setRank((v as CjtfRank) ?? DEFAULT_RECOMMENDED_RANK)}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Select rank" /></SelectTrigger>
            <SelectContent>
              {CJTF_RANKS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
          <p className="text-xs text-gray-400">
            {application.recommended_rank ? (
              <>Intelligence recommended <span className="font-semibold text-purple-700">{application.recommended_rank}</span>.</>
            ) : (
              <>No rank was recommended by Intelligence.</>
            )}{' '}
            Command&apos;s choice here is what prints on the ID card.
            {isLegacy && application.self_reported_rank && (
              <> Applicant self-reported <span className="font-semibold text-amber-700">{application.self_reported_rank}</span>.</>
            )}
          </p>
        </div>
        <div className="space-y-1">
          <Label>Decision Note * (required)</Label>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="State the reason for your approval or rejection…"
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
            onClick={() => handleAction('approve')}
            disabled={!!loading}
            className="bg-cjtf-green hover:bg-cjtf-green-dark"
          >
            {loading === 'approve' ? 'Clearing…' : 'Clear & Send to Training →'}
          </Button>
        </div>
      </div>
    </div>
  )
}
