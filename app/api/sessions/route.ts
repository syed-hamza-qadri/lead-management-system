import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'

export async function POST(request: NextRequest) {
  const { userId, role } = await request.json()

  if (!userId || !role) {
    return NextResponse.json(
      { error: 'User ID and role are required' },
      { status: 400 }
    )
  }

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
    // Generate token
    const token = randomUUID()
    
    // Session expires in 30 days
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

    // Create session
    const { data, error } = await supabase
      .from('sessions')
      .insert({
        user_id: userId,
        token,
        role,
        expires_at: expiresAt,
      })
      .select()

    if (error) throw error

    return NextResponse.json({
      token,
      session: data[0],
    })
  } catch (error) {
    console.error('[v0] Error creating session:', error)
    return NextResponse.json(
      { error: 'Failed to create session' },
      { status: 500 }
    )
  }
}
