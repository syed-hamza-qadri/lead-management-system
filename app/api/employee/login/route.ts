import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { comparePassword } from '@/lib/password'

export async function POST(request: NextRequest) {
  const { name, password } = await request.json()

  if (!name || !password) {
    return NextResponse.json(
      { error: 'Name and password are required' },
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
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )

  try {
    // Verify employee/manager credentials using name - allow both employee and manager roles
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, name, email, password, role')
      .eq('name', name)
      .in('role', ['employee', 'manager'])

    if (userError) throw userError
    
    if (!userData || userData.length === 0) {
      console.log('[v0] Login failed: User not found with name:', name)
      return NextResponse.json(
        { error: 'User not found. Please contact admin to create your account.' },
        { status: 401 }
      )
    }

    const user = userData[0]
    console.log('[v0] Found user:', user.name, user.email, user.role)

    // Verify password using bcryptjs
    const passwordMatch = await comparePassword(password, user.password)
    if (!passwordMatch) {
      console.log('[v0] Login failed: Password mismatch for', name)
      return NextResponse.json(
        { error: 'Invalid password' },
        { status: 401 }
      )
    }

    // Create session in database
    const sessionResponse = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/sessions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          role: user.role,
        }),
      }
    )

    if (!sessionResponse.ok) throw new Error('Failed to create session')
    const sessionData = await sessionResponse.json()

    // Return user data with token
    const { password: _, ...userWithoutPassword } = user
    
    console.log('[v0] Login successful, returning user:', userWithoutPassword)
    
    return NextResponse.json({
      user: userWithoutPassword,
      token: sessionData.token,
      message: 'Login successful',
    })
  } catch (error) {
    console.error('[v0] Login error:', error)
    return NextResponse.json(
      { error: 'Login failed' },
      { status: 500 }
    )
  }
}

