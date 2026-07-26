'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Separate factory for server actions — no try/catch so cookie errors surface
function createActionClient() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )
}

export async function loginAction(formData: FormData) {
  const supabase = createActionClient()
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  console.log('[loginAction] signing in:', email)

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    console.log('[loginAction] auth error:', error.message)
    redirect(`/auth/login?error=${encodeURIComponent(error.message)}`)
  }

  console.log('[loginAction] signed in uid:', data.user.id)

  // Use service role to bypass RLS when reading the profile right after sign-in
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', data.user.id)
    .single()

  const role = profile?.role ?? 'applicant'
  console.log('[loginAction] role:', role, '→ redirect /portal/' + role + '/dashboard')
  revalidatePath('/', 'layout')
  redirect(`/portal/${role}/dashboard`)
}

export async function registerAction(formData: FormData) {
  const supabase = createActionClient()
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const fullName = formData.get('fullName') as string
  const phone = formData.get('phone') as string

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName, role: 'applicant', phone } },
  })

  if (error) {
    redirect(`/auth/register?error=${encodeURIComponent(error.message)}`)
  }

  if (data.user) {
    await supabase.from('profiles').upsert(
      { id: data.user.id, role: 'applicant', full_name: fullName, phone },
      { onConflict: 'id' }
    )
  }

  revalidatePath('/', 'layout')
  redirect('/portal/applicant/verify-phone')
}
