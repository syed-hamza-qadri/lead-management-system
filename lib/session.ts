'use client'

import { useEffect, useState } from 'react'

interface SessionData {
  user_id: string
  user_name: string
  user_role: string
}

let sessionCache: SessionData | null = null
let cacheTime = 0
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

/**
 * Pre-populate the session cache after login.
 * Call this immediately after a successful login response to avoid
 * the extra /api/sessions/validate round-trip on the next page.
 * Note: We can't read HttpOnly cookies from JS, so we use a flag instead.
 */
export function prePopulateSessionCache(data: SessionData) {
  sessionCache = data
  cacheTime = Date.now()
}

/**
 * Clear session cache on logout
 */
export function clearSessionCache() {
  sessionCache = null
  cacheTime = 0
}

export function useSession() {
  const [userId, setUserId] = useState<string | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<SessionData | null>(null)

  useEffect(() => {
    const validateSession = async () => {
      try {
        // Check if we have cached session data (within 5 minutes)
        // This covers both pre-populated cache (after login) and previous validate results
        if (sessionCache && (Date.now() - cacheTime) < CACHE_DURATION) {
          setUserId(sessionCache.user_id)
          setToken('authenticated')
          setSession(sessionCache)
          setLoading(false)
          return
        }

        // Call server endpoint to validate session from HttpOnly cookie
        // The cookie is HttpOnly so we can't check it from JS - let the server decide
        const response = await fetch('/api/sessions/validate', {
          credentials: 'include',
        })

        if (response.ok) {
          const data = await response.json()
          const sessionData: SessionData = {
            user_id: data.user_id,
            user_name: data.user_name || 'User',
            user_role: data.user_role || 'caller',
          }
          
          // Update cache
          sessionCache = sessionData
          cacheTime = Date.now()
          
          setUserId(sessionData.user_id)
          setToken('authenticated')
          setSession(sessionData)
        } else {
          sessionCache = null
          setUserId(null)
          setToken(null)
          setSession(null)
        }
      } catch (error) {
        console.error('[Session] Validation error:', error)
        sessionCache = null
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
  return null
}

export function getStoredUserId(): string | null {
  return null
}
