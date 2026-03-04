import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { CivicHeatmap } from '@/components/CivicHeatmap';
import { LegalDisclaimer } from '@/components/LegalDisclaimer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, AlertTriangle, MapPin, BarChart3, Loader2 } from 'lucide-react';
import { PostService } from '@/services/PostService';
import { useQuery } from '@tanstack/react-query';
import { CATEGORIES } from '@/lib/anonymity';

const postService = PostService.getInstance();

export default function Heatmap() {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['heatmap-stats'],
    queryFn: () => postService.fetchStats(),
  });

  const { data: topLocations = [], isLoading: locationsLoading } = useQuery({
    queryKey: ['top-locations'],
    queryFn: () => postService.fetchTopLocations(),
  });

  const statCards = [
    { 
      label: 'Total Incidents', 
      value: statsLoading ? '—' : String(stats?.totalIncidents || 0), 
      icon: BarChart3, 
      trend: 'All time' 
    },
    { 
      label: 'Active Hotspots', 
      value: statsLoading ? '—' : String(stats?.activeHotspots || 0), 
      icon: MapPin, 
      trend: 'Unique locations' 
    },
    { 
      label: 'Critical Reports', 
      value: statsLoading ? '—' : String(stats?.criticalReports || 0), 
      icon: AlertTriangle, 
      trend: 'High + Critical' 
    },
    { 
      label: 'Trending Category', 
      value: statsLoading ? '—' : (CATEGORIES.find(c => c.id === stats?.trendingCategory)?.label || stats?.trendingCategory || 'None'), 
      icon: TrendingUp, 
      trend: 'Most reports' 
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <LegalDisclaimer variant="banner" />

      <main className="flex-1 container py-8">
        <div className="space-y-6">
          {/* Page header */}
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <MapPin className="h-6 w-6 text-primary" />
              Civic Incident Heatmap
            </h1>
            <p className="text-muted-foreground mt-1">
              Geographic visualization of reported incidents. All locations are approximate to protect reporter privacy.
            </p>
          </div>

          {/* Statistics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {statCards.map((stat) => {
              const Icon = stat.icon;
              return (
                <Card key={stat.label} className="glass-card">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-2xl font-bold">{stat.value}</p>
                        <p className="text-sm text-muted-foreground">{stat.label}</p>
                      </div>
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <Badge variant="secondary" className="mt-2 text-xs">
                      {stat.trend}
                    </Badge>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Heatmap */}
          <CivicHeatmap />

          {/* Top locations table */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Top Incident Locations
              </CardTitle>
            </CardHeader>
            <CardContent>
              {locationsLoading ? (
                <div className="text-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                </div>
              ) : topLocations.length === 0 ? (
                <p className="text-center text-muted-foreground py-4 text-sm">
                  No location-tagged reports yet
                </p>
              ) : (
                <div className="space-y-3">
                  {topLocations.map((loc) => (
                    <div 
                      key={loc.location}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full bg-severity-${loc.severity}`} />
                        <span className="font-medium">{loc.location}</span>
                      </div>
                      <span className="text-muted-foreground">{loc.count} incident{loc.count !== 1 ? 's' : ''}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      <Footer />
    </div>
  );
}
