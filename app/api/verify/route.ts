import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

/**
 * Public ID verification lookup, by CJTF number.
 *
 * Backs the search box on the public website, which is a static site on a
 * different origin — hence the CORS headers. It exposes exactly what the
 * existing /verify/[id] page already shows publicly to anyone holding the
 * number (the same data a printed ID card carries on its face), and nothing
 * more: no email, phone, NIN/BVN, address or payment information.
 *
 * Only COMPLETED applications resolve. Anything else — draft, in screening,
 * rejected, or a number that doesn't exist — returns the same `found: false`,
 * so the endpoint can't be used to probe the status of a pending application.
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get('cjtf_id')?.trim()

  if (!raw) {
    return NextResponse.json({ error: 'Missing cjtf_id' }, { status: 400, headers: CORS })
  }

  // Accept what people actually type: lower case, spaces around the slashes, or
  // dashes instead of slashes (dashes are how the number appears in filenames).
  const cjtfId = raw.toUpperCase().replace(/\s+/g, '').replace(/-/g, '/')

  // Guard the shape before hitting the DB so arbitrary strings can't be used to
  // scan the table via the LIKE-ish surface of an equality filter.
  if (!/^CJTF\/\d{4}\/\d{1,6}$/.test(cjtfId)) {
    return NextResponse.json(
      { found: false, reason: 'malformed' },
      { headers: CORS }
    )
  }

  const service = createServiceClient()
  const { data: app } = await service
    .from('applications')
    .select('cjtf_id_number, first_name, middle_name, last_name, state_of_origin, lga_of_origin, passport_photo_url, completed_at')
    .eq('cjtf_id_number', cjtfId)
    .eq('status', 'COMPLETED')
    .maybeSingle()

  if (!app) {
    return NextResponse.json({ found: false }, { headers: CORS })
  }

  return NextResponse.json(
    {
      found: true,
      member: {
        cjtfId: app.cjtf_id_number,
        fullName: [app.first_name, app.middle_name, app.last_name].filter(Boolean).join(' '),
        stateOfOrigin: app.state_of_origin,
        lgaOfOrigin: app.lga_of_origin,
        photoUrl: app.passport_photo_url,
        issuedAt: app.completed_at,
      },
    },
    { headers: CORS }
  )
}
