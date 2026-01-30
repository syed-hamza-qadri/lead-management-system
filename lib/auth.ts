// lib/auth.ts - Role-based authorization utilities
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export type UserRole = 'admin' | 'manager' | 'caller' | 'lead_generator'

/**
 * Check if user has specific role
 */
export async function hasRole(userId: string, role: UserRole): Promise<boolean> {
  const { data, error } = await supabase
    .from('users')
    .select('role')
    .eq('id', userId)
    .single()

  if (error || !data) return false
  return data.role === role
}

/**
 * Check if user has any of the specified roles
 */
export async function hasAnyRole(userId: string, roles: UserRole[]): Promise<boolean> {
  const { data, error } = await supabase
    .from('users')
    .select('role')
    .eq('id', userId)
    .single()

  if (error || !data) return false
  return roles.includes(data.role as UserRole)
}

/**
 * Get user's role
 */
export async function getUserRole(userId: string): Promise<UserRole | null> {
  const { data, error } = await supabase
    .from('users')
    .select('role')
    .eq('id', userId)
    .single()

  if (error || !data) return null
  return data.role as UserRole
}

/**
 * Check if manager has access to caller
 */
export async function managerHasCallerAccess(
  managerId: string,
  callerId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('user_assignments')
    .select('id')
    .eq('manager_id', managerId)
    .eq('caller_id', callerId)
    .single()

  if (error) return false
  return !!data
}

/**
 * Get all callers for a manager (with optimization)
 */
export async function getManagerCallers(managerId: string) {
  const { data, error } = await supabase
    .from('user_assignments')
    .select(`
      id,
      caller_id,
      users!inner (
        id,
        name,
        email,
        is_active,
        created_at
      )
    `)
    .eq('manager_id', managerId)
    .order('assigned_at', { ascending: false })

  if (error) return []
  
  return data.map(assignment => ({
    assignmentId: assignment.id,
    ...assignment.users
  }))
}

/**
 * Get all niches for a caller
 */
export async function getCallerNiches(callerId: string) {
  const { data, error } = await supabase
    .from('niche_assignments')
    .select(`
      id,
      niche_id,
      assigned_at,
      niches!inner (
        id,
        name,
        description
      )
    `)
    .eq('caller_id', callerId)
    .order('assigned_at', { ascending: false })

  if (error) return []
  
  return data.map(assignment => ({
    assignmentId: assignment.id,
    ...assignment.niches,
    assignedAt: assignment.assigned_at
  }))
}

/**
 * Get all cities for a caller
 */
export async function getCallerCities(callerId: string) {
  const { data, error } = await supabase
    .from('city_assignments')
    .select(`
      id,
      city_id,
      assigned_at,
      cities!inner (
        id,
        name,
        niche_id
      )
    `)
    .eq('caller_id', callerId)
    .order('assigned_at', { ascending: false })

  if (error) return []
  
  return data.map(assignment => ({
    assignmentId: assignment.id,
    ...assignment.cities,
    assignedAt: assignment.assigned_at
  }))
}

/**
 * Get all leads for a caller (with pagination)
 */
export async function getCallerLeads(callerId: string) {
  const { data, error } = await supabase
    .from('city_assignments')
    .select('city_id')
    .eq('caller_id', callerId)

  if (error || !data) return []

  const cityIds = data.map(ca => ca.city_id)
  
  const { data: leads, error: leadsError } = await supabase
    .from('leads')
    .select('*')
    .in('city_id', cityIds)
    .order('created_at', { ascending: false })
    .limit(100) // Pagination - limit to first 100

  if (leadsError || !leads) return []
  return leads.slice(0, 100)
}

/**
 * Assign caller to manager
 */
export async function assignCallerToManager(
  managerId: string,
  callerId: string
): Promise<boolean> {
  const { error } = await supabase
    .from('user_assignments')
    .insert({
      manager_id: managerId,
      caller_id: callerId
    })
    .select()

  return !error
}

/**
 * Unassign caller from manager
 */
export async function unassignCallerFromManager(
  managerId: string,
  callerId: string
): Promise<boolean> {
  const { error } = await supabase
    .from('user_assignments')
    .delete()
    .eq('manager_id', managerId)
    .eq('caller_id', callerId)

  return !error
}

/**
 * Assign niche to caller (fast - no authorization check needed, manager is already authenticated)
 */
export async function assignNicheToCaller(
  callerId: string,
  nicheId: string,
  assignedBy: string
): Promise<boolean> {
  const { error } = await supabase
    .from('niche_assignments')
    .insert({
      caller_id: callerId,
      niche_id: nicheId,
      assigned_by: assignedBy
    })

  return !error
}

/**
 * Unassign niche from caller
 */
export async function unassignNicheFromCaller(
  callerId: string,
  nicheId: string
): Promise<boolean> {
  const { error } = await supabase
    .from('niche_assignments')
    .delete()
    .eq('caller_id', callerId)
    .eq('niche_id', nicheId)

  return !error
}

/**
 * Assign city to caller (fast - no authorization check needed, manager is already authenticated)
 */
export async function assignCityToCaller(
  callerId: string,
  cityId: string,
  assignedBy: string
): Promise<boolean> {
  const { error } = await supabase
    .from('city_assignments')
    .insert({
      caller_id: callerId,
      city_id: cityId,
      assigned_by: assignedBy
    })

  return !error
}

/**
 * Unassign city from caller
 */
export async function unassignCityFromCaller(
  callerId: string,
  cityId: string
): Promise<boolean> {
  const { error } = await supabase
    .from('city_assignments')
    .delete()
    .eq('caller_id', callerId)
    .eq('city_id', cityId)

  return !error
}

/**
 * Log role access for audit
 */
export async function logRoleAccess(
  userId: string,
  role: UserRole,
  action: string
): Promise<void> {
  await supabase
    .from('role_access_log')
    .insert({
      user_id: userId,
      role,
      action
    })
}
