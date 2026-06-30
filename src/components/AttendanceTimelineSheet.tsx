import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { LogIn, LogOut, Receipt, ClipboardList, MapPin, Clock, Navigation } from 'lucide-react';

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

  // 🚀 FIX: Safely parse the location whether it's a string, coordinates, or an address object
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

  // Sort events chronologically safely
  const events = Array.isArray(shift.events) 
    ? [...shift.events].sort((a: any, b: any) => (a.time || 0) - (b.time || 0))
    : [];

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
          {/* Shift Summary Cards */}
          <div className="grid grid-cols-2 gap-3 mb-8">
            <div className="bg-card border rounded-lg p-3 shadow-sm flex flex-col items-center justify-center text-center">
              <Clock className="h-5 w-5 text-muted-foreground mb-1" />
              <span className="text-xs font-semibold text-muted-foreground uppercase">Duration</span>
              <span className="text-sm font-bold mt-1">
                {shift.end_time && shift.start_time
                  ? `${((shift.end_time - shift.start_time) / 3600000).toFixed(1)} hrs` 
                  : 'Active Shift'}
              </span>
            </div>
            <div className="bg-card border rounded-lg p-3 shadow-sm flex flex-col items-center justify-center text-center">
              <Navigation className="h-5 w-5 text-muted-foreground mb-1" />
              <span className="text-xs font-semibold text-muted-foreground uppercase">Distance</span>
              <span className="text-sm font-bold mt-1">{shift.total_distance || 0} km</span>
            </div>
          </div>

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
                    {/* Time Column */}
                    <div className="w-14 shrink-0 text-right pt-1">
                      <span className="text-xs font-bold text-muted-foreground">
                        {item.time ? new Date(item.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                      </span>
                    </div>

                    {/* Icon & Line Column */}
                    <div className="flex flex-col items-center relative">
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center z-10 relative ${styling.bg}`}>
                        <Icon className={`h-4 w-4 ${styling.color}`} />
                      </div>
                      {!isLast && (
                        <div className="w-0.5 bg-border absolute top-8 bottom-0 -mb-2" />
                      )}
                    </div>

                    {/* Content Column */}
                    <div className={`flex-1 pb-8 ${isLast ? '' : ''}`}>
                      <h4 className="text-sm font-bold">{item.title || 'Activity'}</h4>
                      {item.description && (
                        <p className="text-xs text-muted-foreground mt-1 font-medium leading-relaxed">
                          {item.description}
                        </p>
                      )}
                      {/* 🚀 Render the formatted, React-safe location */}
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