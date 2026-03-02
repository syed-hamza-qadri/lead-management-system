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
      { data: activityLog, error: activityErr },
    ] = await Promise.all([
      supabase.from('users').select('*').order('created_at', { ascending: true }),
      supabase.from('niches').select('*').order('created_at', { ascending: true }),
      supabase.from('cities').select('*').order('created_at', { ascending: true }),
      supabase.from('leads').select('*').order('created_at', { ascending: true }),
      supabase.from('lead_responses').select('*').order('created_at', { ascending: true }),
      supabase.from('activity_log').select('*').order('created_at', { ascending: true }),
    ])

    const errors = [usersErr, nichesErr, citiesErr, leadsErr, responsesErr, activityErr].filter(Boolean)
    if (errors.length > 0) {
      console.error('[Backup] Export errors:', errors)
      return NextResponse.json({ error: 'Failed to export some tables' }, { status: 500 })
    }

    // Log the backup action
    await supabase.from('activity_log').insert({
      user_id: userId,
      action_type: 'backup_download',
      description: `Downloaded full system backup (${(users || []).length} users, ${(leads || []).length} leads, ${(niches || []).length} niches, ${(cities || []).length} cities)`,
    })

    const backup = {
      metadata: {
        version: '1.0',
        created_at: new Date().toISOString(),
        system: 'lead-management-system',
        counts: {
          users: (users || []).length,
          niches: (niches || []).length,
          cities: (cities || []).length,
          leads: (leads || []).length,
          lead_responses: (leadResponses || []).length,
          activity_log: (activityLog || []).length,
        },
      },
      tables: {
        users: users || [],
        niches: niches || [],
        cities: cities || [],
        leads: leads || [],
        lead_responses: leadResponses || [],
        activity_log: activityLog || [],
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

    // Delete existing data in correct order (child tables first)
    const deleteOrder = ['activity_log', 'lead_responses', 'leads', 'cities', 'niches', 'sessions']
    for (const table of deleteOrder) {
      const { error } = await supabase.from(table).delete().gte('created_at', '1970-01-01')
      if (error) {
        console.error(`[Backup] Error deleting ${table}:`, error)
        return NextResponse.json({ error: `Failed to clear table: ${table}` }, { status: 500 })
      }
    }

    // Delete users (except current admin to maintain session)
    const { error: deleteUsersErr } = await supabase.from('users').delete().neq('id', userId)
    if (deleteUsersErr) {
      console.error('[Backup] Error deleting users:', deleteUsersErr)
      return NextResponse.json({ error: 'Failed to clear users table' }, { status: 500 })
    }

    // Restore data in correct order (parent tables first)
    let restored = { users: 0, niches: 0, cities: 0, leads: 0, lead_responses: 0, activity_log: 0 }

    // 1. Restore users (skip the current admin user to avoid conflict)
    if (tables.users && tables.users.length > 0) {
      const usersToRestore = tables.users.filter((u: any) => u.id !== userId)
      if (usersToRestore.length > 0) {
        // Insert in batches of 100
        for (let i = 0; i < usersToRestore.length; i += 100) {
          const batch = usersToRestore.slice(i, i + 100)
          const { error } = await supabase.from('users').upsert(batch, { onConflict: 'id' })
          if (error) {
            console.error('[Backup] Error restoring users batch:', error)
          } else {
            restored.users += batch.length
          }
        }
      }
      restored.users += 1 // count current admin
    }

    // 2. Restore niches
    if (tables.niches && tables.niches.length > 0) {
      for (let i = 0; i < tables.niches.length; i += 100) {
        const batch = tables.niches.slice(i, i + 100)
        const { error } = await supabase.from('niches').upsert(batch, { onConflict: 'id' })
        if (error) {
          console.error('[Backup] Error restoring niches batch:', error)
        } else {
          restored.niches += batch.length
        }
      }
    }

    // 3. Restore cities
    if (tables.cities && tables.cities.length > 0) {
      for (let i = 0; i < tables.cities.length; i += 100) {
        const batch = tables.cities.slice(i, i + 100)
        const { error } = await supabase.from('cities').upsert(batch, { onConflict: 'id' })
        if (error) {
          console.error('[Backup] Error restoring cities batch:', error)
        } else {
          restored.cities += batch.length
        }
      }
    }

    // 4. Restore leads
    if (tables.leads && tables.leads.length > 0) {
      for (let i = 0; i < tables.leads.length; i += 100) {
        const batch = tables.leads.slice(i, i + 100)
        const { error } = await supabase.from('leads').upsert(batch, { onConflict: 'id' })
        if (error) {
          console.error('[Backup] Error restoring leads batch:', error)
        } else {
          restored.leads += batch.length
        }
      }
    }

    // 5. Restore lead_responses
    if (tables.lead_responses && tables.lead_responses.length > 0) {
      for (let i = 0; i < tables.lead_responses.length; i += 100) {
        const batch = tables.lead_responses.slice(i, i + 100)
        const { error } = await supabase.from('lead_responses').upsert(batch, { onConflict: 'id' })
        if (error) {
          console.error('[Backup] Error restoring lead_responses batch:', error)
        } else {
          restored.lead_responses += batch.length
        }
      }
    }

    // 6. Restore activity_log
    if (tables.activity_log && tables.activity_log.length > 0) {
      for (let i = 0; i < tables.activity_log.length; i += 100) {
        const batch = tables.activity_log.slice(i, i + 100)
        const { error } = await supabase.from('activity_log').upsert(batch, { onConflict: 'id' })
        if (error) {
          console.error('[Backup] Error restoring activity_log batch:', error)
        } else {
          restored.activity_log += batch.length
        }
      }
    }

    // Log the restore action
    await supabase.from('activity_log').insert({
      user_id: userId,
      action_type: 'backup_restore',
      description: `Restored backup from ${body.metadata.created_at} (${restored.users} users, ${restored.leads} leads, ${restored.niches} niches, ${restored.cities} cities)`,
    })

    return NextResponse.json({
      message: `Backup restored successfully! Restored: ${restored.users} users, ${restored.niches} niches, ${restored.cities} cities, ${restored.leads} leads, ${restored.lead_responses} responses, ${restored.activity_log} activity logs.`,
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
      { count: nichesCount },
      { count: citiesCount },
      { count: activityCount },
      { count: sessionsCount },
    ] = await Promise.all([
      supabase.from('leads').select('id', { count: 'exact', head: true }),
      supabase.from('lead_responses').select('id', { count: 'exact', head: true }),
      supabase.from('niches').select('id', { count: 'exact', head: true }),
      supabase.from('cities').select('id', { count: 'exact', head: true }),
      supabase.from('activity_log').select('id', { count: 'exact', head: true }),
      supabase.from('sessions').select('id', { count: 'exact', head: true }),
    ])

    // Delete in correct foreign key order (child tables first)
    const deleteOperations = [
      { table: 'activity_log', label: 'Activity logs' },
      { table: 'lead_responses', label: 'Lead responses' },
      { table: 'leads', label: 'Leads' },
      { table: 'cities', label: 'Cities' },
      { table: 'niches', label: 'Niches' },
    ]

    for (const op of deleteOperations) {
      const { error } = await supabase.from(op.table).delete().gte('created_at', '1970-01-01')
      if (error) {
        console.error(`[Backup] Error deleting ${op.table}:`, error)
        return NextResponse.json({ error: `Failed to delete ${op.label}` }, { status: 500 })
      }
    }

    // Delete sessions except current user's active session
    const { error: sessionErr } = await supabase.from('sessions').delete().neq('user_id', userId)
    if (sessionErr) {
      console.error('[Backup] Error deleting sessions:', sessionErr)
    }

    // Log the delete action (this creates a new entry after clearing the activity_log)
    await supabase.from('activity_log').insert({
      user_id: userId,
      action_type: 'delete_all_data',
      description: `Deleted all system data: ${leadsCount || 0} leads, ${responsesCount || 0} responses, ${nichesCount || 0} niches, ${citiesCount || 0} cities, ${activityCount || 0} activity logs, ${sessionsCount || 0} sessions`,
    })

    return NextResponse.json({
      message: `All data deleted successfully! Removed: ${leadsCount || 0} leads, ${responsesCount || 0} responses, ${nichesCount || 0} niches, ${citiesCount || 0} cities, ${activityCount || 0} activity logs. User accounts preserved.`,
      deleted: {
        leads: leadsCount || 0,
        lead_responses: responsesCount || 0,
        niches: nichesCount || 0,
        cities: citiesCount || 0,
        activity_log: activityCount || 0,
        sessions: sessionsCount || 0,
      },
    })
  } catch (error) {
    console.error('[Backup] Delete error:', error)
    return NextResponse.json({ error: 'Failed to delete data' }, { status: 500 })
  }
}
