import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { MapPin, Edit, Trash2, Map } from 'lucide-react';

interface Props {
  se: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEditRoute: (route: any) => void;
  onUnassignRoute: (routeId: string) => void;
  canEdit: boolean;
}

export const SERoutesSheet = ({ se, open, onOpenChange, onEditRoute, onUnassignRoute, canEdit }: Props) => {
  if (!se) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl flex flex-col p-0">
        <SheetHeader className="px-6 py-5 border-b bg-muted/30">
          <SheetTitle className="text-xl flex items-center gap-2">
            <Map className="h-5 w-5 text-primary" />
            {se.name}'s Territories
          </SheetTitle>
          <SheetDescription>
            {se.routes?.length || 0} routes are currently assigned to this Sales Executive.
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 px-6 py-4">
          <div className="space-y-6">
            {se.routes?.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <MapPin className="h-8 w-8 mx-auto mb-3 opacity-20" />
                No routes assigned.
              </div>
            ) : (
              se.routes?.map((route: any) => (
                <div key={route.id} className="border rounded-lg bg-card shadow-sm overflow-hidden">
                  <div className="bg-muted/50 px-4 py-3 flex items-center justify-between border-b">
                    <h3 className="font-bold text-primary">{route.name}</h3>
                    {/* 🚀 3. Pencil and Trash icons only render if canEdit is true */}
{canEdit && (
  <div className="flex gap-2">
    <Button variant="ghost" size="icon" onClick={() => onEditRoute(route)}>
      <Edit className="h-4 w-4" />
    </Button>
    <Button variant="ghost" size="icon" onClick={() => onUnassignRoute(route.id)}>
      <Trash2 className="h-4 w-4" />
    </Button>
  </div>
)}
                  </div>
                  
                  <div className="p-4 space-y-4">
                    {route.locations?.map((loc: any, idx: number) => (
                      <div key={idx} className="space-y-2">
                        <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                          <MapPin className="h-3.5 w-3.5" />
                          {loc.taluka}, {loc.district} ({loc.state})
                        </div>
                        <div className="flex flex-wrap gap-1.5 pl-5">
                          {loc.villages?.map((v: string) => (
                            <Badge 
                              key={v} 
                              variant="outline" 
                              className="bg-blue-50 text-blue-700 border-blue-200 font-medium px-2 py-0.5 hover:bg-blue-100"
                            >
                              {v}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};