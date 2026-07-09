import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { LogIn, LogOut, Receipt, ClipboardList, MapPin, Clock, Navigation, Gauge, Map as MapIcon, Users, ClipboardCheck, Leaf } from 'lucide-react';
import { GoogleMap, Polyline, Marker, useJsApiLoader } from '@react-google-maps/api';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { MapContainer, TileLayer, Polyline as LeafletPolyline, Marker as LeafletMarker } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

// 🚀 INTELLIGENT LOCAL DEV MAP FALLBACK
const RouteMap = ({ path }: { path: { lat: number; lng: number }[] }) => {
  const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''
  });

  if (!path || path.length === 0) return <div className="h-full w-full flex items-center justify-center text-xs text-muted-foreground">No GPS route data available.</div>;
  const center = path[0];

  if (loadError || isLocalDev) {
    const leafletPath = path.map(p => [p.lat, p.lng] as [number, number]);
    const leafletCenter: [number, number] = [center.lat, center.lng];

    return (
      <div className="h-full w-full local-dev-map-override">
        <MapContainer center={leafletCenter} zoom={14} style={{ width: '100%', height: '100%' }} zoomControl={false}>
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; OpenStreetMap contributors'
          />
          <LeafletPolyline positions={leafletPath} pathOptions={{ color: '#2563eb', weight: 4 }} />
        </MapContainer>
        <span className="absolute bottom-2 right-2 bg-amber-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-sm z-[1000]">
          Local Dev Map Mode
        </span>
      </div>
    );
  }

  if (!isLoaded) return <div className="h-full w-full flex items-center justify-center text-xs text-muted-foreground">Loading Map...</div>;

  return (
    <GoogleMap
      mapContainerStyle={{ width: '100%', height: '100%' }}
      center={center}
      zoom={14}
      options={{ disableDefaultUI: true, zoomControl: true }}
    >
      <Polyline
        path={path}
        options={{ strokeColor: '#2563eb', strokeOpacity: 0.8, strokeWeight: 4 }}
      />
      <Marker position={path[0]} label="S" />
      <Marker position={path[path.length - 1]} label="E" />
    </GoogleMap>
  );
};

interface Props {
  shift: any | null;
  seName: string;
  open: boolean;
  onClose: () => void;
}

export const AttendanceTimelineSheet = ({ shift, seName, open, onClose }: Props) => {
  const [livePath, setLivePath] = useState<{lat: number, lng: number}[]>([]);
  const [dynamicEvents, setDynamicEvents] = useState<any[]>([]);
  const [routeName, setRouteName] = useState<string>('Loading...');
  
  const [villageRouteMap, setVillageRouteMap] = useState<Map<string, string>>(new Map());
  const [punchedInRoute, setPunchedInRoute] = useState<string>('Others');
  const [allFarmers, setAllFarmers] = useState<any[]>([]);

  useEffect(() => {
    if (!open || !shift) return;

    const fetchExtraData = async () => {
      // 1. Fetch High-Res GPS Location Path
      const { data: locs } = await supabase
        .from('shift_locations')
        .select('lat, lng')
        .eq('shift_id', shift.id)
        .order('timestamp', { ascending: true });
        
      if (locs && locs.length > 0) setLivePath(locs);

      // 2. Fetch ALL Routes for this SE
      const { data: allRoutes } = await supabase
        .from('routes')
        .select('id, name, locations')
        .eq('se_id', shift.se_id);
      
      const vMap = new Map<string, string>();
      let pRoute = 'Others'; 

      if (allRoutes) {
        allRoutes.forEach((r: any) => {
          if (r.id === shift.assigned_route_id) pRoute = r.name;
          (r.locations || []).forEach((loc: any) => {
            (loc.villages || []).forEach((v: string) => {
              vMap.set(v.trim().toLowerCase(), r.name);
            });
          });
        });
      }
      
      setVillageRouteMap(vMap);
      setPunchedInRoute(pRoute);
      setRouteName(pRoute); 

      // 3. Fetch Farmers
      const { data: farmersData } = await supabase
        .from('farmers')
        .select('id, full_name, village, created_at, comments, fspp_details' as any) 
        .eq('se_id', shift.se_id);

      const farmers = farmersData as any[] || []; 
      setAllFarmers(farmers); 

      // 4. 🚀 NEW: Fetch Farm Cards directly from DB to inject into timeline
      const { data: farmCardsData } = await (supabase as any)
        .from('farm_cards')
        .select('id, farmer_id, created_at, status, card_data')
        .eq('se_id', shift.se_id);
      
      const farmCards = farmCardsData as any[] || [];
      
      const injectedEvents: any[] = [];
      const shiftStartTime = shift.start_time || 0;
      
      // --- A. INJECT GENERAL VISITS & B. FSPP ENROLLMENTS ---
      farmers.forEach(f => {
        const comments = Array.isArray(f.comments) ? f.comments : [];
        comments.forEach(c => {
          if (!c.created_at) return;
          const commentDateObj = new Date(c.created_at);
          const localDateStr = `${commentDateObj.getFullYear()}-${String(commentDateObj.getMonth() + 1).padStart(2, '0')}-${String(commentDateObj.getDate()).padStart(2, '0')}`;
          
          if (localDateStr === shift.date) {
            let eventTime = commentDateObj.getTime();
            if (eventTime <= shiftStartTime) eventTime = shiftStartTime + 60000 + (injectedEvents.length * 1000); 
            
            injectedEvents.push({
              type: 'visit',
              title: 'Farmer Checked-In', 
              farmer_name: f.full_name,
              description: c.comment,
              time: eventTime,
              location: f.village || 'Field Visit'
            });
          }
        });

        if (f.fspp_details && f.fspp_details.evaluationDate) {
          const evalDateObj = new Date(f.fspp_details.evaluationDate);
          const evalDateStr = `${evalDateObj.getFullYear()}-${String(evalDateObj.getMonth() + 1).padStart(2, '0')}-${String(evalDateObj.getDate()).padStart(2, '0')}`;
          
          if (evalDateStr === shift.date) {
            let eventTime = evalDateObj.getTime();
            if (eventTime <= shiftStartTime) eventTime = shiftStartTime + 60000 + (injectedEvents.length * 1000); 
            
            injectedEvents.push({
              type: 'fspp',
              title: 'Added FSPP Details', 
              farmer_name: f.full_name,
              description: `Score: ${f.fspp_details.score || 'N/A'} • ${f.fspp_details.category || 'N/A'}\nCommitted: ${f.fspp_details.committedLand || '0'} Acres`,
              time: eventTime,
              location: f.village || 'Field Visit'
            });
          }
        }
      });

      // --- C. 🚀 INJECT FARM CARDS ---
      farmCards.forEach(fc => {
        if (!fc.created_at) return;
        const cardDateObj = new Date(fc.created_at);
        const cardDateStr = `${cardDateObj.getFullYear()}-${String(cardDateObj.getMonth() + 1).padStart(2, '0')}-${String(cardDateObj.getDate()).padStart(2, '0')}`;

        if (cardDateStr === shift.date) {
          let eventTime = cardDateObj.getTime();
          if (eventTime <= shiftStartTime) eventTime = shiftStartTime + 60000 + (injectedEvents.length * 1000); 

          // Cross-reference with our local farmers array to get the name and village
          const matchedFarmer = farmers.find(f => f.id === fc.farmer_id);
          const farmerName = matchedFarmer?.full_name || fc.card_data?.farmerName || 'Unknown Farmer';
          const village = fc.card_data?.village || matchedFarmer?.village || 'Field Visit';
          
          const plotName = fc.card_data?.fieldNumber || 'Unnamed Plot';
          const area = fc.card_data?.cultivatedArea || fc.card_data?.totalLandArea || '0';
          const unit = fc.card_data?.cultivatedAreaUnit || 'Acres';

          injectedEvents.push({
            type: 'farm_card',
            title: 'Farm Card Generated',
            farmer_name: farmerName,
            description: `Plot: ${plotName} • Area: ${area} ${unit}\nStatus: ${(fc.status || 'DRAFT').toUpperCase()}`,
            time: eventTime,
            location: village
          });
        }
      });

      setDynamicEvents(injectedEvents);
    };

    fetchExtraData();
  }, [shift, open]);

  if (!shift) return null;

  const shiftDate = new Date(shift.date).toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const getIconForType = (type: string) => {
    switch(type) {
      case 'punch-in': return { icon: LogIn, color: 'text-green-600', bg: 'bg-green-100' };
      case 'punch-out': return { icon: LogOut, color: 'text-red-600', bg: 'bg-red-100' };
      case 'expense': return { icon: Receipt, color: 'text-amber-600', bg: 'bg-amber-100' };
      case 'visit': return { icon: Users, color: 'text-purple-600', bg: 'bg-purple-100' }; 
      case 'fspp': return { icon: ClipboardCheck, color: 'text-blue-600', bg: 'bg-blue-100' }; 
      case 'farm_card': return { icon: Leaf, color: 'text-amber-600', bg: 'bg-amber-100' }; // 🚀 NEW FARM CARD ICON
      default: return { icon: ClipboardList, color: 'text-blue-600', bg: 'bg-blue-100' };
    }
  };

  const renderLocation = (loc: any, isFarmerEvent: boolean) => {
    if (!loc) return null;
    let placeName = '';
    
    if (typeof loc === 'string') placeName = loc;
    else if (typeof loc === 'object') {
      if (loc.village) placeName = loc.village;
      else if (loc.address) placeName = loc.address.split(',')[0];
      else if (loc.lat && loc.lng) return <span className="truncate font-semibold text-foreground/80">GPS: {Number(loc.lat).toFixed(5)}, {Number(loc.lng).toFixed(5)}</span>;
    }

    if (!placeName) return <span className="truncate font-semibold text-foreground/80">Location Recorded</span>;

    if (!isFarmerEvent || placeName.startsWith('GPS:')) {
       return <span className="truncate font-semibold text-foreground/80">{placeName}</span>;
    }

    let cleanPlace = placeName;
    const parenthesisMatch = placeName.match(/\(([^)]+)\)/);
    if (parenthesisMatch) {
        cleanPlace = parenthesisMatch[1].trim();
    } else {
        cleanPlace = placeName.replace(/^Others[\s-]*\/?\s*/i, '').trim();
    }

    const actualRoute = villageRouteMap.get(cleanPlace.toLowerCase()) || 'Others';
    const displayActualRoute = actualRoute === 'Others' ? `Others (${cleanPlace})` : `${actualRoute} (${cleanPlace})`;

    if (actualRoute === punchedInRoute) {
      return <span className="truncate font-semibold text-foreground/80">{displayActualRoute}</span>;
    } else {
      return (
        <div className="flex flex-col gap-1.5 mt-1">
          <span className="text-[10px] font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded border border-green-200 w-fit">
            Punched in: {punchedInRoute}
          </span>
          <span className="text-[10px] font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded border border-red-200 w-fit">
            Working in: {displayActualRoute}
          </span>
        </div>
      );
    }
  };

  // 🚀 Filter out duplicates: removes raw entries that are handled perfectly by our dynamic systems!
  const rawEvents = (Array.isArray(shift.events) ? shift.events : [])
    .filter((e: any) => 
      e.title !== 'General Visit' && 
      !e.title?.toLowerCase().includes('fspp') && 
      !e.title?.toLowerCase().includes('farm card')
    );

  const events = [...rawEvents, ...dynamicEvents].sort((a: any, b: any) => (a.time || 0) - (b.time || 0));

  let odoDistance: string = '--';
  if (shift.start_km && shift.end_km) {
    const start = parseFloat(shift.start_km);
    const end = parseFloat(shift.end_km);
    if (!isNaN(start) && !isNaN(end)) odoDistance = `${Math.max(0, end - start).toFixed(1)} km`;
  } else if (shift.start_km) {
    odoDistance = 'In Progress';
  }

  const fallbackPath = rawEvents
    .map((item: any) => (item?.location?.lat && item?.location?.lng) ? { lat: Number(item.location.lat), lng: Number(item.location.lng) } : null)
    .filter((pos: any) => pos !== null && !isNaN(pos.lat) && !isNaN(pos.lng));

  const displayPath = livePath.length > 0 ? livePath : fallbackPath;

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-0">
        <SheetHeader className="px-6 py-5 border-b bg-muted/30">
          <SheetTitle className="text-xl">{seName}'s Timeline</SheetTitle>
          <SheetDescription className="font-medium text-primary">
            {shiftDate}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 px-6 py-4">
          
          <div className="mb-4 bg-primary/5 border border-primary/20 rounded-lg p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapIcon className="h-4 w-4 text-primary" />
              <span className="text-xs font-bold text-primary uppercase tracking-wider">Punched-In Route</span>
            </div>
            <Badge variant="outline" className="bg-white border-primary/30 text-foreground font-semibold">
              {routeName}
            </Badge>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="bg-card border rounded-lg p-3 shadow-sm flex flex-col items-center justify-center text-center">
              <Clock className="h-5 w-5 text-muted-foreground mb-1" />
              <span className="text-[10px] font-semibold text-muted-foreground uppercase">Duration</span>
              <span className="text-sm font-bold mt-1">
                {shift.end_time && shift.start_time
                  ? `${((shift.end_time - shift.start_time) / 3600000).toFixed(1)} hrs` 
                  : 'Active'}
              </span>
            </div>
            <div className="bg-card border rounded-lg p-3 shadow-sm flex flex-col items-center justify-center text-center">
              <Navigation className="h-5 w-5 text-muted-foreground mb-1" />
              <span className="text-[10px] font-semibold text-muted-foreground uppercase">GPS Dist.</span>
              <span className="text-sm font-bold mt-1">{shift.total_distance || 0} km</span>
            </div>
            <div className="bg-card border rounded-lg p-3 shadow-sm flex flex-col items-center justify-center text-center">
              <Gauge className="h-5 w-5 text-muted-foreground mb-1" />
              <span className="text-[10px] font-semibold text-muted-foreground uppercase">Odo Dist.</span>
              <span className="text-sm font-bold mt-1">{odoDistance}</span>
            </div>
          </div>

          {(shift.start_odo_image || shift.end_odo_image) && (
            <div className="mb-6 bg-muted/20 border rounded-lg p-4">
              <h4 className="text-sm font-bold mb-3">Vehicle Odometer Readings</h4>
              <div className="grid grid-cols-2 gap-4">
                {shift.start_odo_image && (
                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs font-semibold text-muted-foreground">Start: {shift.start_km ? `${shift.start_km} km` : 'N/A'}</span>
                    <a href={shift.start_odo_image} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-md border shadow-sm hover:opacity-90">
                      <img src={shift.start_odo_image} alt="Start Odo" className="w-full h-24 object-cover" />
                    </a>
                  </div>
                )}
                {shift.end_odo_image && (
                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs font-semibold text-muted-foreground">End: {shift.end_km ? `${shift.end_km} km` : 'N/A'}</span>
                    <a href={shift.end_odo_image} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-md border shadow-sm hover:opacity-90">
                      <img src={shift.end_odo_image} alt="End Odo" className="w-full h-24 object-cover" />
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}

          {displayPath.length > 0 && (
            <div className="mb-8 border rounded-lg overflow-hidden flex flex-col shadow-sm">
              <div className="bg-muted/30 px-4 py-3 border-b flex items-center justify-between">
                <h4 className="text-sm font-bold flex items-center gap-2">
                  <MapIcon className="h-4 w-4 text-primary" /> GPS Travel Route
                </h4>
                <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider">
                  {livePath.length > 0 ? 'Live Telemetry Path' : 'Event Points Path'}
                </span>
              </div>
              <div className="h-[250px] w-full bg-muted/10 relative">
                <RouteMap path={displayPath} />
              </div>
            </div>
          )}

          <div className="space-y-0 relative">
            {events.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">No activities logged for this shift yet.</div>
            ) : (
              events.map((item: any, index: number) => {
                // 🚀 Flag 'farm_card' as a Farmer Event so it receives the intelligent Route Mismatch checks!
                const isFarmerEvent = item.title?.includes('Farmer') || item.type === 'enrollment' || item.type === 'draft' || item.type === 'visit' || item.type === 'fspp' || item.type === 'farm_card';
                
                let rawLoc = item.location;
                let displayDesc = item.description;

                let fName = item.farmer_name || item.farmerName;
                if (!fName && isFarmerEvent && item.type !== 'visit' && item.type !== 'fspp' && item.type !== 'farm_card') {
                  if (item.entity_id || item.farmer_id) {
                    fName = allFarmers.find(f => f.id === (item.entity_id || item.farmer_id))?.full_name;
                  }
                  if (!fName && item.time) {
                    const match = allFarmers.find(f => Math.abs(new Date(f.created_at).getTime() - item.time) < 120000);
                    if (match) fName = match.full_name;
                  }
                }

                if (!rawLoc && displayDesc && isFarmerEvent && item.type !== 'fspp' && item.type !== 'farm_card') {
                  rawLoc = displayDesc;
                  displayDesc = null; 
                }

                const locationNode = renderLocation(rawLoc, isFarmerEvent);
                const styling = getIconForType(item.type);
                const Icon = styling.icon;
                const isLast = index === events.length - 1;

                return (
                  <div key={index} className="flex gap-4 relative">
                    <div className="w-14 shrink-0 text-right pt-1">
                      <span className="text-xs font-bold text-muted-foreground">
                        {item.time ? new Date(item.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                      </span>
                    </div>

                    <div className="flex flex-col items-center relative">
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center z-10 relative ${styling.bg}`}>
                        <Icon className={`h-4 w-4 ${styling.color}`} />
                      </div>
                      {!isLast && <div className="w-0.5 bg-border absolute top-8 bottom-0 -mb-2" />}
                    </div>

                    <div className={`flex-1 pb-8 ${isLast ? '' : ''}`}>
                      <div className="flex items-start justify-between gap-2 mb-1">
                        
                        <h4 className="text-sm font-bold text-foreground">
                          {item.title || 'Activity'}
                          {fName && <span className="text-primary ml-1.5 font-bold">• {fName}</span>}
                        </h4>

                        {item.type === 'visit' && (
                          <Badge variant="secondary" className="shrink-0 max-w-fit bg-purple-100 text-purple-700 hover:bg-purple-100 text-[9px] px-2 py-0 border-purple-200 uppercase tracking-wider font-bold">
                            General Visit
                          </Badge>
                        )}
                        
                        {item.type === 'fspp' && (
                          <Badge variant="secondary" className="shrink-0 max-w-fit bg-blue-100 text-blue-700 hover:bg-blue-100 text-[9px] px-2 py-0 border-blue-200 uppercase tracking-wider font-bold">
                            FSPP Evaluation
                          </Badge>
                        )}

                        {/* 🚀 Render the new Farm Card Badge */}
                        {item.type === 'farm_card' && (
                          <Badge variant="secondary" className="shrink-0 max-w-fit bg-amber-100 text-amber-700 hover:bg-amber-100 text-[9px] px-2 py-0 border-amber-200 uppercase tracking-wider font-bold">
                            Farm Card
                          </Badge>
                        )}
                      </div>

                      {displayDesc && (
                        <p className="text-xs text-muted-foreground mt-0.5 font-medium leading-relaxed whitespace-pre-line">
                          {displayDesc}
                        </p>
                      )}
                      
                      {locationNode && (
                        <div className="flex items-start gap-1.5 mt-2 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3 shrink-0 text-primary/70 mt-0.5" /> 
                          {locationNode}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};