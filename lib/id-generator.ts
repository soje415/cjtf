import { createServiceClient } from '@/lib/supabase/server'

export async function generateCjtfId(): Promise<string> {
  const supabase = createServiceClient()
  const year = new Date().getFullYear()
  const prefix = `CJTF/${year}/`

  // Get the highest existing number for this year (serialized via DB unique constraint)
  const { data } = await supabase
    .from('applications')
    .select('cjtf_id_number')
    .like('cjtf_id_number', `${prefix}%`)
    .order('cjtf_id_number', { ascending: false })
    .limit(1)
    .maybeSingle()

  let nextSeq = 1
  if (data?.cjtf_id_number) {
    const parts = data.cjtf_id_number.split('/')
    nextSeq = parseInt(parts[2], 10) + 1
  }

  return `${prefix}${String(nextSeq).padStart(5, '0')}`
}
