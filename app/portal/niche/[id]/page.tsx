'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getSupabaseClient } from '@/lib/supabase-client'
import { useToast } from '@/hooks/use-toast'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2, ArrowLeft } from 'lucide-react'

interface City {
  id: string
  name: string
  lead_count: number
}

export default function CityList() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const nicheId = params.id as string
  const [cities, setCities] = useState<City[]>([])
  const [nicheName, setNicheName] = useState('')
  const [loading, setLoading] = useState(true)
  const supabase = getSupabaseClient()

  useEffect(() => {
    const fetchCities = async () => {
      try {
        // Get niche name
        const { data: nicheData, error: nicheError } = await supabase
          .from('niches')
          .select('name')
          .eq('id', nicheId)
          .single()

        if (nicheError) throw nicheError
        setNicheName(nicheData?.name || '')

        // Get cities for this niche
        const { data: citiesData, error } = await supabase
          .from('cities')
          .select('id, name')
          .eq('niche_id', nicheId)
          .order('name')

        if (error) throw error

        // Get lead counts for each city
        if (citiesData) {
          const citiesWithCounts = await Promise.all(
            citiesData.map(async (city: any) => {
              const { count } = await supabase
                .from('leads')
                .select('id', { count: 'exact', head: true })
                .eq('city_id', city.id)

              return {
                ...city,
                lead_count: count || 0,
              }
            })
          )
          setCities(citiesWithCounts)
        }
      } catch (error) {
        console.error('[v0] Error fetching cities:', error)
        toast({
          title: 'Error',
          description: 'Failed to load cities',
          variant: 'destructive',
        })
      } finally {
        setLoading(false)
      }
    }

    if (nicheId) {
      fetchCities()
    }
  }, [nicheId, supabase])

  if (loading) {
    return (
      <main className="min-h-screen bg-background p-8 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push('/portal')}
            className="h-10 w-10 p-0"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">{nicheName}</h1>
            <p className="text-muted-foreground mt-2">Select a city to view available leads</p>
          </div>
        </div>

        {cities.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <p className="text-muted-foreground">No cities available in this niche</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {cities.map((city) => (
              <Card
                key={city.id}
                className="hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => router.push(`/portal/city/${city.id}`)}
              >
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <CardTitle>{city.name}</CardTitle>
                    <Badge variant="secondary">{city.lead_count} leads</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">Click to view leads</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
