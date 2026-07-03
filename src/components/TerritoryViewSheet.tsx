import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Map, MapPin, Users, UserCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import FarmerDetailSheet from './FarmerDetailSheet';

interface Props {
  se: any | null;
  open: boolean;
  onClose: () => void;
}

type ViewLevel = 'routes' | 'villages' | 'farmers';

export const TerritoryViewSheet = ({ se, open, onClose }: Props) => {
  const [level, setLevel] = useState<ViewLevel>('routes');
  const [activeRoute, setActiveRoute] = useState<any | null>(null);
  const [activeVillage, setActiveVillage] = useState<string | null>(null);
  
  const [farmers, setFarmers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  // For opening the final profile
  const [selectedFarmer, setSelectedFarmer] = useState<any | null>(null);

  // Reset state when opened/closed
  useEffect(() => {
    if (open && se) {
      setLevel('routes');
      setActiveRoute(null);
      setActiveVillage(null);
      fetchAllFarmersInTerritory();
    }
  }, [open, se]);

  // Fetch all farmers that belong to any village in this SE's routes
  // Fetch all farmers that belong to any village in this SE's routes (Both Submitted & Drafts)
  const fetchAllFarmersInTerritory = async () => {
    if (!se || !se.routes || se.routes.length === 0) return;
    setLoading(true);

    const allVillages = new Set<string>();
    se.routes.forEach((route: any) => {
      route.locations?.forEach((loc: any) => {
        loc.villages?.forEach((v: string) => allVillages.add(v.trim().toLowerCase()));
      });
    });

    // 🚀 NEW: Fetch both Tables at the same time
    const [farmersRes, draftsRes] = await Promise.all([
      supabase.from('farmers').select('*, profiles:se_id(name)').eq('status', 'SUBMITTED'),
      supabase.from('drafts').select('*, profiles:se_id(name)').eq('entity_type', 'farmer')
    ]);

    const submittedFarmers = farmersRes.data || [];
    
    // 🚀 NEW: Reshape the Draft data to look exactly like a normal Farmer record
    // 🚀 NEW: Reshape the FLAT Draft JSON into the NESTED Completed Profile structure
    const draftFarmers = (draftsRes.data || []).map(draft => {
        const data = draft.draft_data as any; 
        
        return {
          id: draft.entity_id || draft.id,
          status: 'DRAFT',
          is_draft: true,
          // Notice the draft uses 'fullName' instead of 'full_name'
          full_name: data?.fullName || data?.full_name || 'Unnamed Draft', 
          mobile: data?.mobile || 'No Mobile',
          village: data?.village || '',
          
          // 🚀 MANUALLY BUILD THE COMPLETED TEMPLATE FROM FLAT DRAFT DATA
          personal_details: {
            village: data?.village || '',
            taluka: data?.taluka || '',
            city: data?.city || '',
            state: data?.state || '',
            pincode: data?.pincode || '',
            fatherName: data?.fatherName || '',
            alternateMobile: data?.alternateMobile || ''
          },
          farm_details: {
            totalLand: data?.totalLand || '',
            landUnit: data?.landUnit || 'Acres',
            irrigatedLand: data?.irrigatedLand || '',
            rainFedLand: data?.rainFedLand || '',
            majorCrops: data?.majorCrops || [],
            soilType: data?.soilType || [],
            waterSource: data?.waterSource || [],
            irrigationType: data?.irrigationType || [],
            farmEquipments: data?.farmEquipments || [],
            cattles: data?.cattles || [],
            sideTrees: data?.sideTrees || [],
            biofertilizer: data?.biofertilizer || '',
            isIntercropping: data?.isIntercropping || ''
          },
          history_details: {
            pastCrops: data?.pastCrops || []
          },
          profiles: draft.profiles
        };
      });
    // Combine them both
    const combinedData = [...submittedFarmers, ...draftFarmers];

    // Filter locally to match the villages in this territory route
    const matchedFarmers = combinedData.filter(f => {
      const v = (f.village || (f.personal_details as any)?.village || '').trim().toLowerCase();
      return allVillages.has(v);
    });

    setFarmers(matchedFarmers);
    setLoading(false);
  };

  // 🚀 HELPER: Count farmers in a specific village safely
  const getFarmerCountForVillage = (villageName: string) => {
    const vSafe = villageName.trim().toLowerCase();
    return farmers.filter(f => (f.village || (f.personal_details as any)?.village || '').trim().toLowerCase() === vSafe).length;
  };

  // 🚀 HELPER: Count farmers in an entire route
  const getFarmerCountForRoute = (route: any) => {
    let count = 0;
    route.locations?.forEach((loc: any) => {
      loc.villages?.forEach((v: string) => {
        count += getFarmerCountForVillage(v);
      });
    });
    return count;
  };

  if (!se) return null;

  return (
    <>
      <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col p-0">
          
          <SheetHeader className="px-6 py-4 border-b bg-muted/30">
            <div className="flex items-center gap-3">
              {level !== 'routes' && (
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => {
                  if (level === 'farmers') setLevel('villages');
                  else if (level === 'villages') { setLevel('routes'); setActiveRoute(null); }
                }}>
                  <ChevronLeft className="h-5 w-5" />
                </Button>
              )}
              <div>
                <SheetTitle className="text-lg flex items-center gap-2">
                  {level === 'routes' && <><Map className="h-5 w-5 text-primary" /> {se.name}'s Territories</>}
                  {level === 'villages' && <><MapPin className="h-5 w-5 text-primary" /> {activeRoute?.name}</>}
                  {level === 'farmers' && <><Users className="h-5 w-5 text-primary" /> Farmers in {activeVillage}</>}
                </SheetTitle>
                <SheetDescription>
                  {level === 'routes' && 'Select a route to view its villages.'}
                  {level === 'villages' && 'Select a village to view enrolled farmers.'}
                  {level === 'farmers' && 'Click a farmer card to view their full dossier.'}
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          <ScrollArea className="flex-1 px-6 py-4 bg-muted/10">
            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : (
              <div className="space-y-3">
                
                {/* LEVEL 1: ROUTES */}
                {level === 'routes' && (
                  se.routes.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground italic">No routes assigned to this executive.</div>
                  ) : (
                    se.routes.map((route: any) => {
                      const count = getFarmerCountForRoute(route);
                      return (
                        <div 
                          key={route.id} 
                          onClick={() => { setActiveRoute(route); setLevel('villages'); }}
                          className="flex items-center justify-between p-4 bg-card border rounded-lg shadow-sm cursor-pointer hover:border-primary transition-colors group"
                        >
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 bg-primary/10 rounded-full flex items-center justify-center">
                              <Map className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <h4 className="font-bold text-sm">{route.name}</h4>
                              <p className="text-xs text-muted-foreground mt-0.5">{route.locations?.length || 0} Blocks</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <span className="block text-lg font-bold text-foreground leading-none">{count}</span>
                              <span className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wider">Farmers</span>
                            </div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                          </div>
                        </div>
                      );
                    })
                  )
                )}

                {/* LEVEL 2: VILLAGES */}
                {level === 'villages' && activeRoute && (
                  activeRoute.locations?.flatMap((loc: any) => loc.villages || []).map((villageName: string, i: number) => {
                    const count = getFarmerCountForVillage(villageName);
                    return (
                      <div 
                        key={i}
                        onClick={() => { setActiveVillage(villageName); setLevel('farmers'); }}
                        className="flex items-center justify-between p-4 bg-card border rounded-lg shadow-sm cursor-pointer hover:border-primary transition-colors group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 bg-amber-100 rounded-full flex items-center justify-center">
                            <MapPin className="h-4 w-4 text-amber-700" />
                          </div>
                          <h4 className="font-semibold text-sm">{villageName}</h4>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant="secondary" className="font-bold">{count} Farmers</Badge>
                          <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                        </div>
                      </div>
                    );
                  })
                )}

                {/* LEVEL 3: FARMERS */}
                {/* LEVEL 3: FARMERS */}
                {level === 'farmers' && activeVillage && (
                  (() => {
                    const villageFarmers = farmers.filter(f => (f.village || (f.personal_details as any)?.village || '').trim().toLowerCase() === activeVillage.trim().toLowerCase());
                    
                    if (villageFarmers.length === 0) return <div className="text-center py-12 text-muted-foreground italic">No farmers enrolled in this village yet.</div>;

                    return villageFarmers.map((farmer: any) => (
                      <div 
                        key={farmer.id}
                        onClick={() => setSelectedFarmer(farmer)}
                        className={`flex items-center justify-between p-4 bg-card border rounded-lg shadow-sm cursor-pointer transition-colors ${farmer.is_draft ? 'hover:border-amber-400 border-amber-200 bg-amber-50/30' : 'hover:border-primary'}`}
                      >
                        <div className="flex items-center gap-3">
                          <UserCircle className={`h-10 w-10 ${farmer.is_draft ? 'text-amber-500/50' : 'text-muted-foreground/50'}`} />
                          <div>
                          <div className="flex items-center gap-2">
                              <h4 className="font-bold text-sm truncate max-w-[140px] sm:max-w-[200px]" title={farmer.full_name}>
                                {farmer.full_name}
                              </h4>
                              {/* 🚀 NEW: Draft Badge */}
                              {farmer.is_draft && (
                                <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300 text-[9px] px-1.5 py-0">
                                  DRAFT
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">{farmer.mobile}</p>
                          </div>
                        </div>
                        <Badge variant="outline" className={farmer.is_draft ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-green-50 text-green-700 border-green-200"}>
                          View Profile
                        </Badge>
                      </div>
                    ));
                  })()
                )}

              </div>
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* 🚀 LEVEL 4: THE ACTUAL FARMER DOSSIER */}
      <FarmerDetailSheet 
        farmer={selectedFarmer}
        open={!!selectedFarmer}
        onClose={() => setSelectedFarmer(null)}
        canEdit={false} // Force read-only from this view to keep it safe!
      />
    </>
  );
};