import { useState, useEffect } from 'react';
import { MapPin, Filter, Layers } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CATEGORIES } from '@/lib/anonymity';
import type { Category } from '@/lib/anonymity';
import { supabase } from '@/integrations/supabase/client';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

interface HeatmapData {
  location: string;
  coordinates: { lat: number; lng: number };
  incidentCount: number;
  categories: { category: Category; count: number }[];
  severity: 'low' | 'medium' | 'high';
}

// Static geocoding lookup for common locations (fallback for quick resolution)
const LOCATION_COORDS: Record<string, { lat: number; lng: number }> = {
  'mumbai': { lat: 19.076, lng: 72.8777 },
  'delhi': { lat: 28.6139, lng: 77.209 },
  'new delhi': { lat: 28.6139, lng: 77.209 },
  'kolkata': { lat: 22.5726, lng: 88.3639 },
  'bangalore': { lat: 12.9716, lng: 77.5946 },
  'bengaluru': { lat: 12.9716, lng: 77.5946 },
  'chennai': { lat: 13.0827, lng: 80.2707 },
  'hyderabad': { lat: 17.385, lng: 78.4867 },
  'pune': { lat: 18.5204, lng: 73.8567 },
  'ahmedabad': { lat: 23.0225, lng: 72.5714 },
  'jaipur': { lat: 26.9124, lng: 75.7873 },
  'lucknow': { lat: 26.8467, lng: 80.9462 },
  'patna': { lat: 25.6093, lng: 85.1376 },
  'bhopal': { lat: 23.2599, lng: 77.4126 },
  'chandigarh': { lat: 30.7333, lng: 76.7794 },
  'thiruvananthapuram': { lat: 8.5241, lng: 76.9366 },
  'guwahati': { lat: 26.1445, lng: 91.7362 },
  'bhubaneswar': { lat: 20.2961, lng: 85.8245 },
  'dehradun': { lat: 30.3165, lng: 78.0322 },
  'ranchi': { lat: 23.3441, lng: 85.3096 },
  'raipur': { lat: 21.2514, lng: 81.6296 },
  'srinagar': { lat: 34.0837, lng: 74.7973 },
  'shimla': { lat: 31.1048, lng: 77.1734 },
  'gangtok': { lat: 27.3389, lng: 88.6065 },
  'imphal': { lat: 24.817, lng: 93.9368 },
  'agartala': { lat: 23.8315, lng: 91.2868 },
  'kohima': { lat: 25.6751, lng: 94.1086 },
  'aizawl': { lat: 23.7271, lng: 92.7176 },
  'itanagar': { lat: 27.0844, lng: 93.6053 },
  'panaji': { lat: 15.4909, lng: 73.8278 },
  'goa': { lat: 15.2993, lng: 74.124 },
  'surat': { lat: 21.1702, lng: 72.8311 },
  'nagpur': { lat: 21.1458, lng: 79.0882 },
  'indore': { lat: 22.7196, lng: 75.8577 },
  'vadodara': { lat: 22.3072, lng: 73.1812 },
  'coimbatore': { lat: 11.0168, lng: 76.9558 },
  'visakhapatnam': { lat: 17.6868, lng: 83.2185 },
  'noida': { lat: 28.5355, lng: 77.391 },
  'gurgaon': { lat: 28.4595, lng: 77.0266 },
  'gurugram': { lat: 28.4595, lng: 77.0266 },
  'faridabad': { lat: 28.4089, lng: 77.3178 },
  // Indian states
  'haryana': { lat: 29.0588, lng: 76.0856 },
  'rajasthan': { lat: 27.0238, lng: 74.2179 },
  'uttar pradesh': { lat: 26.8467, lng: 80.9462 },
  'maharashtra': { lat: 19.7515, lng: 75.7139 },
  'karnataka': { lat: 15.3173, lng: 75.7139 },
  'tamil nadu': { lat: 11.1271, lng: 78.6569 },
  'kerala': { lat: 10.8505, lng: 76.2711 },
  'gujarat': { lat: 22.2587, lng: 71.1924 },
  'madhya pradesh': { lat: 22.9734, lng: 78.6569 },
  'west bengal': { lat: 22.9868, lng: 87.855 },
  'bihar': { lat: 25.0961, lng: 85.3131 },
  'andhra pradesh': { lat: 15.9129, lng: 79.74 },
  'telangana': { lat: 18.1124, lng: 79.0193 },
  'punjab': { lat: 31.1471, lng: 75.3412 },
  'odisha': { lat: 20.9517, lng: 85.0985 },
  'assam': { lat: 26.2006, lng: 92.9376 },
  'jharkhand': { lat: 23.6102, lng: 85.2799 },
  'chhattisgarh': { lat: 21.2787, lng: 81.8661 },
  'uttarakhand': { lat: 30.0668, lng: 79.0193 },
  'himachal pradesh': { lat: 31.1048, lng: 77.1734 },
  'tripura': { lat: 23.9408, lng: 91.9882 },
  'meghalaya': { lat: 25.467, lng: 91.3662 },
  'manipur': { lat: 24.6637, lng: 93.9063 },
  'nagaland': { lat: 26.1584, lng: 94.5624 },
  'mizoram': { lat: 23.1645, lng: 92.9376 },
  'arunachal pradesh': { lat: 28.218, lng: 94.7278 },
  'sikkim': { lat: 27.533, lng: 88.5122 },
  // Common place descriptors
  'metro district': { lat: 19.076, lng: 72.8777 },
  'central hospital': { lat: 28.6139, lng: 77.209 },
  'riverside colony': { lat: 22.5726, lng: 88.3639 },
  'highway 47 section': { lat: 12.9716, lng: 77.5946 },
  'downtown': { lat: 28.6329, lng: 77.2195 },
  'industrial zone': { lat: 19.033, lng: 73.0297 },
};

// Geocode using OpenStreetMap Nominatim API (free, no API key needed)
async function geocodeLocation(location: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(location)}&format=json&limit=1&accept-language=en`
    );
    const data = await response.json();
    if (data && data.length > 0) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    }
  } catch (e) {
    console.warn('Geocoding failed for:', location, e);
  }
  return null;
}

function getCoordinatesForLocation(location: string): { lat: number; lng: number } | null {
  const lower = location.toLowerCase().trim();
  // Remove ", india" suffix for matching
  const cleaned = lower.replace(/,?\s*india\s*$/i, '').trim();

  // Direct match
  if (LOCATION_COORDS[cleaned]) return LOCATION_COORDS[cleaned];
  if (LOCATION_COORDS[lower]) return LOCATION_COORDS[lower];

  // Partial match
  for (const [key, coords] of Object.entries(LOCATION_COORDS)) {
    if (cleaned.includes(key) || key.includes(cleaned)) return coords;
  }

  return null;
}

const severityColorValues: Record<string, string> = {
  low: '#22c55e',
  medium: '#f59e0b',
  high: '#ef4444',
};

interface CivicHeatmapProps {
  className?: string;
}

export function CivicHeatmap({ className }: CivicHeatmapProps) {
  const [selectedCategory, setSelectedCategory] = useState<Category | 'all'>('all');
  const [selectedLocation, setSelectedLocation] = useState<HeatmapData | null>(null);
  const [heatmapData, setHeatmapData] = useState<HeatmapData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHeatmapData();
  }, []);

  const fetchHeatmapData = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('posts')
      .select('location, category, severity')
      .not('location', 'is', null);

    if (error) {
      console.error('Error fetching heatmap data:', error);
      setLoading(false);
      return;
    }

    // Group posts by location
    const locationMap: Record<string, {
      categories: Record<string, number>;
      severities: Record<string, number>;
      count: number;
    }> = {};

    for (const post of (data || [])) {
      if (!post.location) continue;
      const loc = post.location;
      if (!locationMap[loc]) {
        locationMap[loc] = { categories: {}, severities: {}, count: 0 };
      }
      locationMap[loc].count++;
      locationMap[loc].categories[post.category] = (locationMap[loc].categories[post.category] || 0) + 1;
      locationMap[loc].severities[post.severity] = (locationMap[loc].severities[post.severity] || 0) + 1;
    }

    // Convert to HeatmapData, geocoding locations that aren't in the static lookup
    const result: HeatmapData[] = [];
    for (const [location, locData] of Object.entries(locationMap)) {
      let coords = getCoordinatesForLocation(location);

      // If not found in static lookup, try geocoding API
      if (!coords) {
        coords = await geocodeLocation(location);
      }

      if (!coords) continue;

      const categories = Object.entries(locData.categories).map(([category, count]) => ({
        category: category as Category,
        count,
      }));

      let severity: 'low' | 'medium' | 'high' = 'low';
      if (locData.severities['critical'] || locData.severities['high']) severity = 'high';
      else if (locData.severities['medium']) severity = 'medium';

      result.push({
        location,
        coordinates: coords,
        incidentCount: locData.count,
        categories,
        severity,
      });
    }

    setHeatmapData(result);
    setLoading(false);
  };

  const filteredData = selectedCategory === 'all'
    ? heatmapData
    : heatmapData.filter(d => d.categories.some(c => c.category === selectedCategory));

  const getMarkerRadius = (count: number) => {
    if (count >= 20) return 18;
    if (count >= 10) return 14;
    return 10;
  };

  return (
    <div className={className}>
      <Card className="glass-card overflow-hidden">
        <CardHeader className="border-b border-border/50">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Civic Incident Heatmap</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={selectedCategory} onValueChange={(v) => setSelectedCategory(v as Category | 'all')}>
                <SelectTrigger className="w-40 bg-muted/50 border-border">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {/* Map */}
          <div className="relative h-[450px]">
            <MapContainer
              center={[20.5937, 78.9629]}
              zoom={5}
              className="h-full w-full z-0"
              scrollWheelZoom={true}
            >
              <TileLayer
                attribution='&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
                url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
              />
              {filteredData.map((data) => (
                <CircleMarker
                  key={data.location}
                  center={[data.coordinates.lat, data.coordinates.lng]}
                  radius={getMarkerRadius(data.incidentCount)}
                  fillColor={severityColorValues[data.severity]}
                  color={severityColorValues[data.severity]}
                  weight={2}
                  opacity={0.9}
                  fillOpacity={0.5}
                  eventHandlers={{
                    click: () => setSelectedLocation(
                      selectedLocation?.location === data.location ? null : data
                    ),
                  }}
                >
                  <Popup>
                    <div className="text-sm">
                      <strong>{data.location}</strong>
                      <br />
                      {data.incidentCount} incident{data.incidentCount !== 1 ? 's' : ''}
                    </div>
                  </Popup>
                </CircleMarker>
              ))}
            </MapContainer>

            {loading && (
              <div className="absolute inset-0 z-[1200] bg-background/65 backdrop-blur-[1px] p-4 sm:p-6 flex items-end pointer-events-none">
                <div className="w-full space-y-3">
                  <div className="h-8 w-40 rounded cv-shimmer" />
                  <div className="h-4 w-2/3 rounded cv-shimmer" />
                  <div className="h-4 w-1/2 rounded cv-shimmer" />
                </div>
              </div>
            )}

            {/* Legend */}
            <div className="absolute bottom-3 right-3 z-[1000] flex items-center gap-2 px-3 py-2 bg-card/90 backdrop-blur-sm rounded-lg shadow-md border border-border/50">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full" style={{ background: severityColorValues.low }} />
                <span className="text-xs text-muted-foreground">Low</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full" style={{ background: severityColorValues.medium }} />
                <span className="text-xs text-muted-foreground">Medium</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full" style={{ background: severityColorValues.high }} />
                <span className="text-xs text-muted-foreground">High</span>
              </div>
            </div>

            {/* Privacy notice */}
            <div className="absolute bottom-3 left-3 z-[1000] flex items-center gap-2 px-3 py-2 bg-card/90 backdrop-blur-sm rounded-lg shadow-md border border-border/50">
              <Layers className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Approximate locations only</span>
            </div>
          </div>

          {/* No data message */}
          {!loading && heatmapData.length === 0 && (
            <div className="p-8 text-center text-muted-foreground">
              <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No location-tagged reports yet</p>
              <p className="text-xs mt-1">Submit reports with locations to see them on the map</p>
            </div>
          )}

          {/* Selected location details */}
          {selectedLocation && (
            <div className="p-4 border-t border-border/50 bg-muted/10 cv-content-fade">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h4 className="font-medium flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-primary" />
                    {selectedLocation.location}
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    {selectedLocation.incidentCount} incident{selectedLocation.incidentCount !== 1 ? 's' : ''} reported
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className={`border-severity-${selectedLocation.severity} text-severity-${selectedLocation.severity}`}
                >
                  {selectedLocation.severity} density
                </Badge>
              </div>
              <div className="flex flex-wrap gap-2">
                {selectedLocation.categories.map((cat) => {
                  const categoryInfo = CATEGORIES.find(c => c.id === cat.category);
                  return (
                    <Badge key={cat.category} variant="secondary" className="text-xs">
                      {categoryInfo?.label}: {cat.count}
                    </Badge>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
