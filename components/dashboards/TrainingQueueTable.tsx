'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Application } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

export default function TrainingQueueTable({ apps }: { apps: Application[] }) {
  const router = useRouter()
  const [loadingId, setLoadingId] = useState<string | null>(null)

  async function confirmTraining(id: string) {
    setLoadingId(id)
    const res = await fetch(`/api/applications/${id}/confirm-training`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    const data = await res.json().catch(() => ({}))
    if (res.ok) {
      toast.success('Training confirmed — forwarded to ICT for ID generation.')
      router.refresh()
    } else {
      toast.error(data.error || 'Action failed')
    }
    setLoadingId(null)
  }

  if (apps.length === 0) return null

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Pending Training Completion</CardTitle></CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-gray-500 text-xs uppercase">
                <th className="text-left pb-2 pr-4">Name</th>
                <th className="text-left pb-2 pr-4">State / LGA</th>
                <th className="text-left pb-2 pr-4">Cleared</th>
                <th className="text-left pb-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {apps.map((app) => (
                <tr key={app.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="py-2 pr-4 font-medium">{app.first_name} {app.last_name}</td>
                  <td className="py-2 pr-4 text-gray-600">{app.state_of_origin} / {app.lga_of_origin}</td>
                  <td className="py-2 pr-4 text-gray-500">
                    {app.admin_approved_at ? new Date(app.admin_approved_at).toLocaleDateString('en-NG') : '—'}
                  </td>
                  <td className="py-2">
                    <Button
                      size="sm"
                      onClick={() => confirmTraining(app.id)}
                      disabled={loadingId === app.id}
                      className="text-xs bg-indigo-600 hover:bg-indigo-700"
                    >
                      {loadingId === app.id ? 'Confirming…' : 'Confirm Training Completed'}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
