import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { listUssdIssuers } from '@/lib/hyparrow-pay'

// GET /api/hyparrow/ussd/issuers — banks that support USSD collection.
export async function GET() {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const res = await listUssdIssuers()
    return NextResponse.json({ issuers: res.data ?? [] })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Could not load USSD banks' },
      { status: 502 }
    )
  }
}
