import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const ADMIN_PASSWORD = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || 'shaq2154'

export async function POST(request: NextRequest) {
  const { password } = await request.json()

  if (!password) {
    return NextResponse.json(
      { error: 'Password is required' },
      { status: 400 }
    )
  }

  // Verify admin password
  if (password !== ADMIN_PASSWORD) {
    return NextResponse.json(
      { error: 'Invalid admin password' },
      { status: 401 }
    )
  }

  // Create backend session for admin
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Ignored
          }
        },
      },
    }
  )

  try {
    // Check if ANY admin already exists
    const { data: existingAdmins, error: checkError } = await supabase
      .from('users')
      .select('id, name, email, role')
      .eq('role', 'admin')

    if (checkError) throw checkError

    let adminUser: any = existingAdmins && existingAdmins.length > 0 ? existingAdmins[0] : null

    // If no admin exists, create one
    if (!adminUser) {
      console.log('[v0] No admin found, creating first admin user')
      const { data: newAdmin, error: createError } = await supabase
        .from('users')
        .insert({
          name: 'System Admin',
          email: 'admin@system.com',
          role: 'admin',
          password: '', // Password not used for admin login
        })
        .select()
        .single()

      if (createError) throw createError
      adminUser = newAdmin
      if (adminUser) {
        console.log('[v0] Created admin user:', adminUser.name)
      }
    } else {
      console.log('[v0] Admin already exists, reusing:', adminUser.name)
    }

    if (!adminUser) {
      throw new Error('Failed to get or create admin user')
    }

    // Create session for admin
    const sessionResponse = await fetch(
      '/api/sessions',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: adminUser.id,
          role: 'admin',
        }),
      }
    )

    if (!sessionResponse.ok) {
      throw new Error('Failed to create session')
    }

    const sessionData = await sessionResponse.json()

    return NextResponse.json({
      message: 'Admin login successful',
      token: sessionData.token,
      user: adminUser,
    })
  } catch (error) {
    console.error('Admin login error:', error)
    return NextResponse.json(
      { error: 'Login failed' },
      { status: 500 }
    )
  }
}
