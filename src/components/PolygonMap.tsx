import React, { useMemo, useState } from 'react';
import { GoogleMap, Polygon, InfoWindow, useJsApiLoader } from '@react-google-maps/api';
import { MapContainer, TileLayer, Polygon as LeafletPolygon, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Loader2 } from 'lucide-react';

export interface MapPolygonFeature {
  id: string;
  title: string;
  type: 'Farm Card' | 'Farm Diary';
  coords: any[]; // Accept any JSON coordinate format
}

// Helper to safely extract lat/lng regardless of how the mobile app saved it
const normalizeCoord = (pt: any): { lat: number, lng: number } => {
  if (!pt) return { lat: 0, lng: 0 };
  if (typeof pt.lat !== 'undefined' && typeof pt.lng !== 'undefined') {
    return { lat: Number(pt.lat), lng: Number(pt.lng) };
  }
  if (typeof pt.latitude !== 'undefined' && typeof pt.longitude !== 'undefined') {
    return { lat: Number(pt.latitude), lng: Number(pt.longitude) };
  }
  if (Array.isArray(pt) && pt.length >= 2) {
    return { lat: Number(pt[0]), lng: Number(pt[1]) };
  }
  return { lat: 22.2587, lng: 71.1924 }; // Fallback to Gujarat
};

// 🚀 NEW: Reusable Floating Legend Component
const MapLegend = () => (
  <div className="absolute bottom-8 left-4 bg-white/95 backdrop-blur p-3 rounded-lg shadow-md border z-[1000] pointer-events-auto">
    <div className="text-[10px] font-bold text-slate-500 mb-2 uppercase tracking-wider">Plot Legend</div>
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 rounded-sm bg-[#16A34A] opacity-50 border-2 border-[#16A34A]"></div>
        <span className="text-xs font-bold text-slate-700">Farm Card</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 rounded-sm bg-[#2563EB] opacity-50 border-2 border-[#2563EB]"></div>
        <span className="text-xs font-bold text-slate-700">Farm Diary</span>
      </div>
    </div>
  </div>
);

export const PolygonMap = ({ polygons }: { polygons: MapPolygonFeature[] }) => {
  const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''
  });

  const [selectedPolygon, setSelectedPolygon] = useState<MapPolygonFeature | null>(null);

  const center = useMemo(() => {
    if (!polygons || polygons.length === 0) return { lat: 22.2587, lng: 71.1924 };
    
    for (const poly of polygons) {
      if (poly.coords && poly.coords.length > 0) {
        return normalizeCoord(poly.coords[0]);
      }
    }
    return { lat: 22.2587, lng: 71.1924 };
  }, [polygons]);

  if (!polygons || polygons.length === 0) {
    return (
      <div className="h-full w-full flex items-center justify-center text-sm text-muted-foreground bg-muted/20 border border-dashed rounded-lg">
        No farm boundaries mapped in this area yet.
      </div>
    );
  }

  // Fallback for Local Development (Leaflet)
  if (loadError || isLocalDev) {
    const leafletCenter: [number, number] = [center.lat, center.lng];
    
    if (isNaN(leafletCenter[0]) || isNaN(leafletCenter[1])) {
       return <div className="p-4 text-red-500">Invalid coordinate data detected.</div>;
    }

    return (
      <div className="h-full w-full rounded-lg overflow-hidden border shadow-sm relative z-0">
        {/* 🚀 Render Legend */}
        <MapLegend />
        
        <MapContainer center={leafletCenter} zoom={13} style={{ width: '100%', height: '100%' }}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {polygons.map((poly) => {
            if (!poly.coords || poly.coords.length === 0) return null;
            
            const positions = poly.coords.map(p => {
              const n = normalizeCoord(p);
              return [n.lat, n.lng] as [number, number];
            });
            const color = poly.type === 'Farm Card' ? '#16A34A' : '#2563EB'; 
            
            return (
              <LeafletPolygon key={poly.id} positions={positions} pathOptions={{ color, fillColor: color, fillOpacity: 0.4, weight: 2 }}>
                <Popup>
                  <div className="font-bold">{poly.title}</div>
                  <div className="text-xs text-muted-foreground">{poly.type} Plot</div>
                </Popup>
              </LeafletPolygon>
            );
          })}
        </MapContainer>
      </div>
    );
  }

  if (!isLoaded) return <div className="h-full w-full flex items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;

  const onLoad = (map: google.maps.Map) => {
    const bounds = new window.google.maps.LatLngBounds();
    let hasValidPoints = false;
    
    polygons.forEach(poly => {
      if (poly.coords && poly.coords.length > 0) {
        poly.coords.forEach(coord => {
          const n = normalizeCoord(coord);
          if (!isNaN(n.lat) && !isNaN(n.lng)) {
            bounds.extend(n);
            hasValidPoints = true;
          }
        });
      }
    });
    
    if (hasValidPoints) {
      map.fitBounds(bounds);
    }
  };

  return (
    <div className="h-full w-full rounded-lg overflow-hidden border shadow-sm relative">
      {/* 🚀 Render Legend */}
      <MapLegend />
      
      <GoogleMap
        mapContainerStyle={{ width: '100%', height: '100%' }}
        center={center}
        zoom={13}
        onLoad={onLoad}
        options={{ mapTypeId: 'hybrid', disableDefaultUI: false }}
      >
        {polygons.map(poly => {
          if (!poly.coords || poly.coords.length === 0) return null;
          
          const paths = poly.coords.map(normalizeCoord);
          
          // 🚀 Distinct Colors Applied Here
          const color = poly.type === 'Farm Card' ? '#16A34A' : '#2563EB';
          
          return (
            <Polygon
              key={poly.id}
              paths={paths}
              options={{ strokeColor: color, fillColor: color, fillOpacity: 0.4, strokeWeight: 2 }}
              onClick={() => setSelectedPolygon(poly)}
            />
          );
        })}
        
        {selectedPolygon && selectedPolygon.coords && selectedPolygon.coords.length > 0 && (
          <InfoWindow
            position={normalizeCoord(selectedPolygon.coords[0])}
            onCloseClick={() => setSelectedPolygon(null)}
          >
            <div className="p-1">
              <div style={{ fontWeight: 'bold', color: '#000', fontSize: '14px' }}>{selectedPolygon.title}</div>
              <div style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>{selectedPolygon.type} Boundary</div>
            </div>
          </InfoWindow>
        )}
      </GoogleMap>
    </div>
  );
};