import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { LogIn, LogOut, Receipt, ClipboardList, MapPin, Clock, Navigation, Gauge, Map as MapIcon } from 'lucide-react';
import { GoogleMap, Polyline, Marker, useJsApiLoader } from '@react-google-maps/api';

// 🚀 NEW: Dedicated Map Component to render the Route Path
const RouteMap = ({ path }: { path: { lat: number; lng: number }[] }) => {
  // Replace with your actual Google Maps API Key (preferably from your .env file)
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    // 🚀 MUST HAVE THE VITE_ PREFIX
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY 
  });

  if (!isLoaded) return <div className="h-full w-full flex items-center justify-center text-xs text-muted-foreground">Loading Map...</div>;
  if (!path || path.length === 0) return <div className="h-full w-full flex items-center justify-center text-xs text-muted-foreground">No GPS route data available.</div>;

  // Center map on the first point of the route
  const center = path[0];

  return (
    <GoogleMap
      mapContainerStyle={{ width: '100%', height: '100%' }}
      center={center}
      zoom={14}
      options={{ disableDefaultUI: true, zoomControl: true }}
    >
      <Polyline
        path={path}
        options={{
          strokeColor: '#2563eb', // Blue primary color
          strokeOpacity: 0.8,
          strokeWeight: 4,
        }}
      />
      {/* Optional: Add markers for Start and End points */}
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
  if (!shift) return null;

  const shiftDate = new Date(shift.date).toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const getIconForType = (type: string) => {
    switch(type) {
      case 'punch-in': return { icon: LogIn, color: 'text-green-600', bg: 'bg-green-100' };
      case 'punch-out': return { icon: LogOut, color: 'text-red-600', bg: 'bg-red-100' };
      case 'expense': return { icon: Receipt, color: 'text-amber-600', bg: 'bg-amber-100' };
      default: return { icon: ClipboardList, color: 'text-blue-600', bg: 'bg-blue-100' };
    }
  };

  const formatLocation = (loc: any) => {
    if (!loc) return null;
    if (typeof loc === 'string') return loc;
    if (typeof loc === 'object') {
      if (loc.address) return loc.address;
      if (loc.lat && loc.lng) return `GPS: ${Number(loc.lat).toFixed(5)}, ${Number(loc.lng).toFixed(5)}`;
      return 'Location Recorded';
    }
    return String(loc);
  };

  const events = Array.isArray(shift.events) 
    ? [...shift.events].sort((a: any, b: any) => (a.time || 0) - (b.time || 0))
    : [];

  let odoDistance: string = '--';
  if (shift.start_km && shift.end_km) {
    const start = parseFloat(shift.start_km);
    const end = parseFloat(shift.end_km);
    if (!isNaN(start) && !isNaN(end)) {
      odoDistance = `${Math.max(0, end - start).toFixed(1)} km`;
    }
  } else if (shift.start_km) {
    odoDistance = 'In Progress';
  }

 // 🚀 EXTRACT ROUTE FROM EVENTS: Scan the chronological events array 
  // and pull out every valid lat/lng coordinate to draw the path!
  // 🚀 BULLETPROOF ROUTE EXTRACTION: Safely parse and drop corrupted GPS coordinates
  const routePath = events
    .map((item: any) => {
      // 1. Ensure the location object and keys actually exist
      if (item?.location && item.location.lat && item.location.lng) {
        return {
          lat: Number(item.location.lat),
          lng: Number(item.location.lng)
        };
      }
      return null;
    })
    // 2. Filter out nulls AND any coordinates that failed to parse into valid numbers (NaN)
    .filter((pos: any) => pos !== null && !isNaN(pos.lat) && !isNaN(pos.lng));

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
                    <span className="text-xs font-semibold text-muted-foreground">
                      Start: {shift.start_km ? `${shift.start_km} km` : 'N/A'}
                    </span>
                    <a href={shift.start_odo_image} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-md border shadow-sm hover:opacity-90 transition-opacity">
                      <img src={shift.start_odo_image} alt="Start Odometer" className="w-full h-24 object-cover" />
                    </a>
                  </div>
                )}
                {shift.end_odo_image && (
                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs font-semibold text-muted-foreground">
                      End: {shift.end_km ? `${shift.end_km} km` : 'N/A'}
                    </span>
                    <a href={shift.end_odo_image} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-md border shadow-sm hover:opacity-90 transition-opacity">
                      <img src={shift.end_odo_image} alt="End Odometer" className="w-full h-24 object-cover" />
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 🚀 NEW: Google Maps Route Block */}
          {routePath.length > 0 && (
            <div className="mb-8 border rounded-lg overflow-hidden flex flex-col shadow-sm">
              <div className="bg-muted/30 px-4 py-3 border-b flex items-center justify-between">
                <h4 className="text-sm font-bold flex items-center gap-2">
                  <MapIcon className="h-4 w-4 text-primary" /> GPS Travel Route
                </h4>
                <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider">Live Path</span>
              </div>
              <div className="h-[250px] w-full bg-muted/10 relative">
                <RouteMap path={routePath} />
              </div>
            </div>
          )}

          {/* Timeline */}
          <div className="space-y-0 relative">
            {events.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">No activities logged for this shift yet.</div>
            ) : (
              events.map((item: any, index: number) => {
                const styling = getIconForType(item.type);
                const Icon = styling.icon;
                const isLast = index === events.length - 1;
                const safeLocation = formatLocation(item.location);

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
                      {!isLast && (
                        <div className="w-0.5 bg-border absolute top-8 bottom-0 -mb-2" />
                      )}
                    </div>

                    <div className={`flex-1 pb-8 ${isLast ? '' : ''}`}>
                      <h4 className="text-sm font-bold">{item.title || 'Activity'}</h4>
                      {item.description && (
                        <p className="text-xs text-muted-foreground mt-1 font-medium leading-relaxed">
                          {item.description}
                        </p>
                      )}
                      {safeLocation && (
                        <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3 shrink-0" /> 
                          <span className="truncate">{safeLocation}</span>
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