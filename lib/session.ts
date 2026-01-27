'use client'

import { useEffect, useState } from 'react'

interface SessionData {
  user_id: string
  user_name: string
  user_email: string
  user_role: string
}

export function useSession() {
  const [userId, setUserId] = useState<string | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<SessionData | null>(null)

  useEffect(() => {
    const validateSession = async () => {
      try {
        // Call server endpoint to validate session from HttpOnly cookie
        const response = await fetch('/api/sessions/validate', {
          credentials: 'include', // Include HttpOnly cookies
        })

        if (response.ok) {
          const data = await response.json()
          setUserId(data.user_id)
          setToken('authenticated') // Not the actual token, just a flag
          setSession({
            user_id: data.user_id,
            user_name: data.user_name,
            user_email: data.user_email,
            user_role: data.user_role,
          })
        } else {
          // Session invalid or expired
          setUserId(null)
          setToken(null)
          setSession(null)
        }
      } catch (error) {
        console.error('[Session] Validation error:', error)
        setUserId(null)
        setToken(null)
        setSession(null)
      } finally {
        setLoading(false)
      }
    }

    validateSession()
  }, [])

  return { userId, token, loading, session }
}

export function getStoredToken(): string | null {
  // This function is deprecated - session is now server-side only
  return null
}

export function getStoredUserId(): string | null {
  // This function is deprecated - session is now server-side only
  return null
}
