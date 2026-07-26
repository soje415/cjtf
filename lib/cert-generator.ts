import { createServiceClient } from '@/lib/supabase/server'

// Unique certificate number for an issued office registration.
// Format: CJTF/OFC/<year>/<5-digit seq>. Mirrors lib/id-generator.ts; the
// UNIQUE constraint on office_registrations.cert_number serializes collisions.
export async function generateCertNumber(): Promise<string> {
  const supabase = createServiceClient()
  const year = new Date().getFullYear()
  const prefix = `CJTF/OFC/${year}/`

  const { data } = await supabase
    .from('office_registrations')
    .select('cert_number')
    .like('cert_number', `${prefix}%`)
    .order('cert_number', { ascending: false })
    .limit(1)
    .maybeSingle()

  let nextSeq = 1
  if (data?.cert_number) {
    const parts = data.cert_number.split('/')
    nextSeq = parseInt(parts[3], 10) + 1
  }

  return `${prefix}${String(nextSeq).padStart(5, '0')}`
}
