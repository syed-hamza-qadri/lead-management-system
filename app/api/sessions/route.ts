import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

// POST removed - sessions are now created directly by login routes
// This prevents unauthenticated session creation

export async function DELETE(request: NextRequest) {
  // Get token from HttpOnly cookie
  const token = request.cookies.get('session_token')?.value

  if (!token) {
    return NextResponse.json(
      { error: 'Token is required' },
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
    // Get the user info from the session before deleting
    const { data: sessionData } = await supabase
      .from('sessions')
      .select('user_id, user_name, role')
      .eq('token', token)
      .single()

    // Delete session from database
    const { error } = await supabase
      .from('sessions')
      .delete()
      .eq('token', token)

    if (error) throw error

    // Log logout activity
    if (sessionData?.user_id) {
      await supabase.from('activity_log').insert({
        user_id: sessionData.user_id,
        action_type: 'logout',
        description: `${sessionData.role} ${sessionData.user_name || 'User'} logged out`,
      })
    }

    // Clear the HttpOnly cookie
    const response = NextResponse.json({
      message: 'Session deleted successfully',
    })

    response.cookies.delete('session_token')

    return response
  } catch (error) {
    console.error('[v0] Error deleting session:', error)
    return NextResponse.json(
      { error: 'Failed to delete session' },
      { status: 500 }
    )
  }
}
