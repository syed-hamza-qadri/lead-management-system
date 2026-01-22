'use client'

import { useEffect, useState } from 'react'

export function useSession() {
  const [userId, setUserId] = useState<string | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get token and user from localStorage
    const storedToken = localStorage.getItem('session_token')
    const storedUser = localStorage.getItem('employee_user')
    
    if (storedToken && storedUser) {
      try {
        const user = JSON.parse(storedUser)
        setUserId(user.id)
        setToken(storedToken)
      } catch (error) {
        console.error('Error parsing stored user:', error)
      }
    }
    setLoading(false)
  }, [])

  return { userId, token, loading }
}

export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('session_token')
}

export function getStoredUserId(): string | null {
  if (typeof window === 'undefined') return null
  const user = localStorage.getItem('employee_user')
  if (user) {
    try {
      return JSON.parse(user).id
    } catch {
      return null
    }
  }
  return null
}
