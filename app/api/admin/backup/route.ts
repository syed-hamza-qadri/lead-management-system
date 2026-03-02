import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

function createSupabaseServer(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  return createServerClient(
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
}

async function validateAdmin(request: NextRequest, cookieStore: Awaited<ReturnType<typeof cookies>>) {
  const token = request.cookies.get('session_token')?.value
  if (!token) return null

  const supabase = createSupabaseServer(cookieStore)
  const { data: sessionData } = await supabase
    .from('sessions')
    .select('user_id, role')
    .eq('token', token)
    .gt('expires_at', new Date().toISOString())
    .single()

  if (!sessionData || sessionData.role !== 'admin') return null
  return { supabase, userId: sessionData.user_id }
}

// GET - Download full backup
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const auth = await validateAdmin(request, cookieStore)
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized - Admin access required' }, { status: 403 })
    }
    const { supabase, userId } = auth

    // Fetch all tables in parallel
    const [
      { data: users, error: usersErr },
      { data: niches, error: nichesErr },
      { data: cities, error: citiesErr },
      { data: leads, error: leadsErr },
      { data: leadResponses, error: responsesErr },
      { data: leadCorrections, error: correctionsErr },
      { data: activityLog, error: activityErr },
      { data: userAssignments, error: userAssignErr },
      { data: nicheAssignments, error: nicheAssignErr },
      { data: cityAssignments, error: cityAssignErr },
    ] = await Promise.all([
      supabase.from('users').select('*').order('created_at', { ascending: true }),
      supabase.from('niches').select('*').order('created_at', { ascending: true }),
      supabase.from('cities').select('*').order('created_at', { ascending: true }),
      supabase.from('leads').select('*').order('created_at', { ascending: true }),
      supabase.from('lead_responses').select('*').order('created_at', { ascending: true }),
      supabase.from('lead_corrections').select('*').order('created_at', { ascending: true }),
      supabase.from('activity_log').select('*').order('created_at', { ascending: true }),
      supabase.from('user_assignments').select('*'),
      supabase.from('niche_assignments').select('*'),
      supabase.from('city_assignments').select('*'),
    ])

    const errors = [usersErr, nichesErr, citiesErr, leadsErr, responsesErr, correctionsErr, activityErr, userAssignErr, nicheAssignErr, cityAssignErr].filter(Boolean)
    if (errors.length > 0) {
      console.error('[Backup] Export errors:', errors)
      return NextResponse.json({ error: 'Failed to export some tables' }, { status: 500 })
    }

    // Log the backup action
    await supabase.from('activity_log').insert({
      user_id: userId,
      action_type: 'backup_download',
      description: `Downloaded full system backup (${(users || []).length} users, ${(leads || []).length} leads, ${(niches || []).length} niches, ${(cities || []).length} cities, ${(leadCorrections || []).length} corrections)`,
    })

    const backup = {
      metadata: {
        version: '1.1',
        created_at: new Date().toISOString(),
        system: 'lead-management-system',
        counts: {
          users: (users || []).length,
          niches: (niches || []).length,
          cities: (cities || []).length,
          leads: (leads || []).length,
          lead_responses: (leadResponses || []).length,
          lead_corrections: (leadCorrections || []).length,
          activity_log: (activityLog || []).length,
          user_assignments: (userAssignments || []).length,
          niche_assignments: (nicheAssignments || []).length,
          city_assignments: (cityAssignments || []).length,
        },
      },
      tables: {
        users: users || [],
        niches: niches || [],
        cities: cities || [],
        leads: leads || [],
        lead_responses: leadResponses || [],
        lead_corrections: leadCorrections || [],
        activity_log: activityLog || [],
        user_assignments: userAssignments || [],
        niche_assignments: nicheAssignments || [],
        city_assignments: cityAssignments || [],
      },
    }

    return NextResponse.json(backup)
  } catch (error) {
    console.error('[Backup] Export error:', error)
    return NextResponse.json({ error: 'Failed to create backup' }, { status: 500 })
  }
}

// POST - Restore from backup
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const auth = await validateAdmin(request, cookieStore)
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized - Admin access required' }, { status: 403 })
    }
    const { supabase, userId } = auth

    const body = await request.json()

    // Validate backup structure
    if (!body.metadata || !body.tables) {
      return NextResponse.json({ error: 'Invalid backup file format - missing metadata or tables' }, { status: 400 })
    }

    if (!body.metadata.system || body.metadata.system !== 'lead-management-system') {
      return NextResponse.json({ error: 'Invalid backup file - not from this system' }, { status: 400 })
    }

    const { tables } = body

    // Delete existing data in correct order (child tables first, respecting foreign keys)
    const deleteOrder = [
      'lead_corrections', 'activity_log', 'lead_responses',
      'city_assignments', 'niche_assignments', 'user_assignments',
      'leads', 'cities', 'niches', 'sessions',
    ]
    for (const table of deleteOrder) {
      // Some tables may not have created_at, use a broad delete
      const { error } = await supabase.from(table).delete().gte('created_at', '1970-01-01')
      if (error) {
        // Fallback: try deleting without created_at filter (for assignment tables)
        const { error: err2 } = await supabase.from(table).delete().not('id', 'is', null)
        if (err2) {
          console.error(`[Backup] Error deleting ${table}:`, err2)
          return NextResponse.json({ error: `Failed to clear table: ${table}` }, { status: 500 })
        }
      }
    }

    // Delete users (except current admin to maintain session)
    const { error: deleteUsersErr } = await supabase.from('users').delete().neq('id', userId)
    if (deleteUsersErr) {
      console.error('[Backup] Error deleting users:', deleteUsersErr)
      return NextResponse.json({ error: 'Failed to clear users table' }, { status: 500 })
    }

    // Restore data in correct order (parent tables first)
    let restored = {
      users: 0, niches: 0, cities: 0, leads: 0,
      lead_responses: 0, lead_corrections: 0, activity_log: 0,
      user_assignments: 0, niche_assignments: 0, city_assignments: 0,
    }

    // Helper to restore a table in batches
    const restoreBatch = async (tableName: string, data: any[], conflictCol = 'id') => {
      let count = 0
      if (!data || data.length === 0) return 0
      for (let i = 0; i < data.length; i += 100) {
        const batch = data.slice(i, i + 100)
        const { error } = await supabase.from(tableName).upsert(batch, { onConflict: conflictCol })
        if (error) {
          console.error(`[Backup] Error restoring ${tableName} batch:`, error)
        } else {
          count += batch.length
        }
      }
      return count
    }

    // 1. Restore users (skip the current admin user to avoid conflict)
    if (tables.users && tables.users.length > 0) {
      const usersToRestore = tables.users.filter((u: any) => u.id !== userId)
      restored.users = await restoreBatch('users', usersToRestore) + 1 // +1 for current admin
    }

    // 2. Restore niches
    restored.niches = await restoreBatch('niches', tables.niches)

    // 3. Restore cities (depends on niches)
    restored.cities = await restoreBatch('cities', tables.cities)

    // 4. Restore leads (depends on users, cities)
    restored.leads = await restoreBatch('leads', tables.leads)

    // 5. Restore user_assignments (depends on users)
    restored.user_assignments = await restoreBatch('user_assignments', tables.user_assignments)

    // 6. Restore niche_assignments (depends on users, niches)
    restored.niche_assignments = await restoreBatch('niche_assignments', tables.niche_assignments)

    // 7. Restore city_assignments (depends on users, cities)
    restored.city_assignments = await restoreBatch('city_assignments', tables.city_assignments)

    // 8. Restore lead_corrections (depends on leads, users)
    restored.lead_corrections = await restoreBatch('lead_corrections', tables.lead_corrections)

    // 9. Restore lead_responses (depends on leads, users)
    restored.lead_responses = await restoreBatch('lead_responses', tables.lead_responses)

    // 10. Restore activity_log
    restored.activity_log = await restoreBatch('activity_log', tables.activity_log)

    // Log the restore action
    await supabase.from('activity_log').insert({
      user_id: userId,
      action_type: 'backup_restore',
      description: `Restored backup from ${body.metadata.created_at} (${restored.users} users, ${restored.leads} leads, ${restored.niches} niches, ${restored.cities} cities, ${restored.lead_corrections} corrections, ${restored.user_assignments + restored.niche_assignments + restored.city_assignments} assignments)`,
    })

    return NextResponse.json({
      message: `Backup restored successfully! Restored: ${restored.users} users, ${restored.niches} niches, ${restored.cities} cities, ${restored.leads} leads, ${restored.lead_responses} responses, ${restored.lead_corrections} corrections, ${restored.activity_log} activity logs, ${restored.user_assignments + restored.niche_assignments + restored.city_assignments} assignments.`,
      restored,
    })
  } catch (error) {
    console.error('[Backup] Restore error:', error)
    return NextResponse.json({ error: 'Failed to restore backup' }, { status: 500 })
  }
}

// DELETE - Delete all data (preserve user accounts)
export async function DELETE(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const auth = await validateAdmin(request, cookieStore)
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized - Admin access required' }, { status: 403 })
    }
    const { supabase, userId } = auth

    // Count existing data before deletion
    const [
      { count: leadsCount },
      { count: responsesCount },
      { count: correctionsCount },
      { count: nichesCount },
      { count: citiesCount },
      { count: activityCount },
      { count: sessionsCount },
      { count: userAssignCount },
      { count: nicheAssignCount },
      { count: cityAssignCount },
    ] = await Promise.all([
      supabase.from('leads').select('id', { count: 'exact', head: true }),
      supabase.from('lead_responses').select('id', { count: 'exact', head: true }),
      supabase.from('lead_corrections').select('id', { count: 'exact', head: true }),
      supabase.from('niches').select('id', { count: 'exact', head: true }),
      supabase.from('cities').select('id', { count: 'exact', head: true }),
      supabase.from('activity_log').select('id', { count: 'exact', head: true }),
      supabase.from('sessions').select('id', { count: 'exact', head: true }),
      supabase.from('user_assignments').select('*', { count: 'exact', head: true }),
      supabase.from('niche_assignments').select('*', { count: 'exact', head: true }),
      supabase.from('city_assignments').select('*', { count: 'exact', head: true }),
    ])

    // Delete in correct foreign key order (child tables first)
    const deleteOperations = [
      { table: 'lead_corrections', label: 'Lead corrections' },
      { table: 'activity_log', label: 'Activity logs' },
      { table: 'lead_responses', label: 'Lead responses' },
      { table: 'city_assignments', label: 'City assignments' },
      { table: 'niche_assignments', label: 'Niche assignments' },
      { table: 'user_assignments', label: 'User assignments' },
      { table: 'leads', label: 'Leads' },
      { table: 'cities', label: 'Cities' },
      { table: 'niches', label: 'Niches' },
    ]

    for (const op of deleteOperations) {
      const { error } = await supabase.from(op.table).delete().gte('created_at', '1970-01-01')
      if (error) {
        // Fallback for tables without created_at
        const { error: err2 } = await supabase.from(op.table).delete().not('id', 'is', null)
        if (err2) {
          console.error(`[Backup] Error deleting ${op.table}:`, err2)
          return NextResponse.json({ error: `Failed to delete ${op.label}` }, { status: 500 })
        }
      }
    }

    // Delete sessions except current user's active session
    const { error: sessionErr } = await supabase.from('sessions').delete().neq('user_id', userId)
    if (sessionErr) {
      console.error('[Backup] Error deleting sessions:', sessionErr)
    }

    const totalAssignments = (userAssignCount || 0) + (nicheAssignCount || 0) + (cityAssignCount || 0)

    // Log the delete action (this creates a new entry after clearing the activity_log)
    await supabase.from('activity_log').insert({
      user_id: userId,
      action_type: 'delete_all_data',
      description: `Deleted all system data: ${leadsCount || 0} leads, ${responsesCount || 0} responses, ${correctionsCount || 0} corrections, ${nichesCount || 0} niches, ${citiesCount || 0} cities, ${activityCount || 0} activity logs, ${sessionsCount || 0} sessions, ${totalAssignments} assignments`,
    })

    return NextResponse.json({
      message: `All data deleted successfully! Removed: ${leadsCount || 0} leads, ${responsesCount || 0} responses, ${correctionsCount || 0} corrections, ${nichesCount || 0} niches, ${citiesCount || 0} cities, ${activityCount || 0} activity logs, ${totalAssignments} assignments. User accounts preserved.`,
      deleted: {
        leads: leadsCount || 0,
        lead_responses: responsesCount || 0,
        lead_corrections: correctionsCount || 0,
        niches: nichesCount || 0,
        cities: citiesCount || 0,
        activity_log: activityCount || 0,
        sessions: sessionsCount || 0,
        user_assignments: userAssignCount || 0,
        niche_assignments: nicheAssignCount || 0,
        city_assignments: cityAssignCount || 0,
      },
    })
  } catch (error) {
    console.error('[Backup] Delete error:', error)
    return NextResponse.json({ error: 'Failed to delete data' }, { status: 500 })
  }
}
