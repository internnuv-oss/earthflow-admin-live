import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Loader2, Shield, Plus, User, ChevronLeft, ChevronRight, BarChart2 } from 'lucide-react';
import { RouteBuilderDialog } from '@/components/RouteBuilderDialog';
import { SERoutesSheet } from '@/components/SERoutesSheet';
import { TerritoryViewSheet, AnalyticsTable } from '@/components/TerritoryViewSheet';

interface RoutesPageProps {
  onLogout: () => void;
}

const ITEMS_PER_PAGE = 10; 

// 🚀 SMART EXTRACTOR: Grabs standard and manually typed "Other Villages" from a route
// 🚀 FIXED: Aggregates villages from the standard "Route" row AND the custom "Other Route" row
const extractAllRouteVillages = (route: any): string[] => {
  let vills: string[] = [];
  
  // 1. Extract from standard "Route" row arrays inside locations
  if (route.locations && Array.isArray(route.locations)) {
    route.locations.forEach((loc: any) => {
      // Standard route villages dropdown array
      if (loc.villages && Array.isArray(loc.villages)) {
        vills.push(...loc.villages);
      }
      
      // If "Other Route" villages are saved inside individual location objects
      const locOther = loc.otherVillages || loc.other_villages || loc.other_route_villages;
      if (Array.isArray(locOther)) {
        vills.push(...locOther);
      } else if (typeof locOther === 'string') {
        vills.push(...locOther.split(',').map((v: string) => v.trim()).filter(Boolean));
      }
    });
  }

  // 2. Extract from the Route directly (If "Other Route" row is its own top-level column)
  const routeOther = route.otherVillages || route.other_villages || route.other_route_villages || route.other_route;
  if (Array.isArray(routeOther)) {
    vills.push(...routeOther);
  } else if (typeof routeOther === 'string') {
    vills.push(...routeOther.split(',').map((v: string) => v.trim()).filter(Boolean));
  }

  // Deduplicate using Set to ensure that if a village accidentally appears in both, it counts as 1
  return Array.from(new Set(vills));
};

const RoutesPage = ({ onLogout }: RoutesPageProps) => {
  const [seList, setSeList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [currentPage, setCurrentPage] = useState(1);
  
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [editData, setEditData] = useState<any | null>(null);
  const [selectedSheetSE, setSelectedSheetSE] = useState<any | null>(null);
  const [selectedViewSE, setSelectedViewSE] = useState<any | null>(null);

  const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false);
  const [analyticsData, setAnalyticsData] = useState<any[]>([]);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  const { toast } = useToast();
  const { session, loading: authLoading } = useAuth();
  const { getModulePerm, loading: permLoading } = usePermissions(session?.user?.id || '');
  const routesAccess = getModulePerm('routes');

  useEffect(() => {
    if (!authLoading && !permLoading && routesAccess.can_view) {
      fetchSEsAndRoutes();
    }
  }, [authLoading, permLoading, routesAccess.can_view]);

  const fetchSEsAndRoutes = async () => {
    setLoading(true);
    
    try {
      // 1. Fetch SE Profiles
      // 🚀 FIXED: Added filter to exclusively select real executives where is_demo is false or null
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select(`id, name, is_demo, routes!routes_se_id_fkey ( * )`)
        .eq('role', 'SE')
        .or('is_demo.eq.false,is_demo.is.null')
        .order('name');

      if (profilesError) throw profilesError;

      // 🚀 2. BYPASS SUPABASE 1,000 ROW LIMIT
      // Safely fetch ALL farmers and drafts in batches to guarantee no data is dropped
      let allFarmers: any[] = [];
      let allDrafts: any[] = [];
      let from = 0;
      const step = 1000;

      while (true) {
        const { data, error } = await supabase
          .from('farmers')
          .select('se_id, village')
          .eq('status', 'SUBMITTED')
          .range(from, from + step - 1);
        
        if (error) break;
        if (data && data.length > 0) allFarmers.push(...data);
        if (!data || data.length < step) break;
        from += step;
      }

      from = 0;
      while (true) {
        const { data, error } = await supabase
          .from('drafts')
          .select('se_id, draft_data')
          .eq('entity_type', 'farmer')
          .range(from, from + step - 1);
          
        if (error) break;
        if (data && data.length > 0) allDrafts.push(...data);
        if (!data || data.length < step) break;
        from += step;
      }

      // 3. Group all actual ground-truth farmer villages by SE
      const actualVillagesBySE = new Map<string, Set<string>>();
      
      allFarmers.forEach(f => {
        if (!actualVillagesBySE.has(f.se_id)) actualVillagesBySE.set(f.se_id, new Set());
        const v = (f.village || '').trim();
        if (v) actualVillagesBySE.get(f.se_id)!.add(v); 
      });

      allDrafts.forEach(d => {
        if (!actualVillagesBySE.has(d.se_id)) actualVillagesBySE.set(d.se_id, new Set());
        const draftData = d.draft_data as any || {};
        const v = (draftData.village || draftData.personal_details?.village || '').trim();
        if (v) actualVillagesBySE.get(d.se_id)!.add(v);
      });

      // 4. Format SE list and inject "Others (Out of Route)" if needed
      const formatted = (profilesData || []).map((se: any) => {
        const rawRoutes = se.routes || [];
        const sortedRoutes = [...rawRoutes].sort((a: any, b: any) => 
          (a.name || '').localeCompare((b.name || ''), undefined, { numeric: true, sensitivity: 'base' })
        );
        
        const officialVillages = new Set<string>();
        sortedRoutes.forEach((r: any) => {
          const vills = extractAllRouteVillages(r);
          vills.forEach(v => officialVillages.add(v.trim().toLowerCase()));
        });

        const orphanVillagesMap = new Map<string, string>();
        const actualVillages = actualVillagesBySE.get(se.id) || new Set();
        
        actualVillages.forEach(v => {
          if (!officialVillages.has(v.toLowerCase())) {
            orphanVillagesMap.set(v.toLowerCase(), v);
          }
        });

        let displayRoutes = [...sortedRoutes];

        if (orphanVillagesMap.size > 0) {
          displayRoutes.push({
            id: 'others-custom-route',
            name: 'Others (Out of Route)',
            is_custom_others: true, 
            locations: [{ villages: Array.from(orphanVillagesMap.values()) }]
          });
        }

        return { id: se.id, name: se.name, routes: displayRoutes };
      });

      setSeList(formatted);
      setCurrentPage(1); 
      
      if (selectedSheetSE) {
        const updatedSE = formatted.find((s: any) => s.id === selectedSheetSE.id);
        if (updatedSE) setSelectedSheetSE(updatedSE);
      }
    } catch (err: any) {
      toast({ title: 'Failed to load routes', description: err.message, variant: 'destructive' });
    }
    
    setLoading(false);
  };
  

  const handleOpenGlobalAnalytics = async () => {
    setIsAnalyticsOpen(true);
    setAnalyticsLoading(true);

    try {
      const allVillages = seList.flatMap(se => se.routes.flatMap((r: any) => extractAllRouteVillages(r)));
      const uniqueVillages = Array.from(new Set(allVillages)) as string[];
      
      let fetchedFarmers: any[] = [];

      if (uniqueVillages.length > 0) {
        const { data, error } = await supabase.from('farmers').select('*').in('village', uniqueVillages);
        if (error) throw error;
        if (data) fetchedFarmers = data;
      }

      const seEntities = seList.map((se) => {
        const seVillages = se.routes.flatMap((r: any) => extractAllRouteVillages(r));
        const uniqueSeVillages = Array.from(new Set(seVillages)) as string[];
        const seFarmers = fetchedFarmers.filter(f => uniqueSeVillages.includes(f.village));
        
        return {
          name: se.name || 'Unknown SE', 
          villageCount: uniqueSeVillages.length, 
          farmers: seFarmers
        };
      });

      const activeSeEntities = seEntities.filter(e => e.villageCount > 0);
      setAnalyticsData(activeSeEntities);
    } catch (error: any) {
      toast({ title: 'Analytics Error', description: error.message, variant: 'destructive' });
    }
    
    setAnalyticsLoading(false);
  };

  const handleUnassignRoute = async (routeId: string) => {
    if (!confirm('Are you sure you want to remove this route from the SE?')) return;
    const { error } = await supabase.from('routes').delete().eq('id', routeId);
    if (error) toast({ title: 'Error deleting route', description: error.message, variant: 'destructive' });
    else {
      toast({ title: 'Route Removed', description: 'The territory has been deleted successfully.' });
      fetchSEsAndRoutes();
    }
  };

  const openEditDialog = (route: any) => {
    setEditData({ id: route.id, name: route.name, se_id: selectedSheetSE.id, locations: route.locations });
    setSelectedSheetSE(null);
    setIsBuilderOpen(true);
  };

  const handleCreateNew = () => {
    setEditData(null);
    setIsBuilderOpen(true);
  };

  if (authLoading || permLoading) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!routesAccess.can_view) {
    return (
      <AppLayout onLogout={onLogout}>
        <div className="flex flex-col items-center justify-center h-[60vh] text-center">
          <Shield className="h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold">Access Denied</h2>
        </div>
      </AppLayout>
    );
  }

  const totalPages = Math.ceil(seList.length / ITEMS_PER_PAGE);
  const paginatedList = seList.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  return (
    <AppLayout onLogout={onLogout}>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold">Territory Routes</h2>
          <p className="text-sm text-muted-foreground">Manage service routes grouped by Sales Executive.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <Button onClick={handleOpenGlobalAnalytics} variant="outline" className="gap-2 text-indigo-600 hover:text-indigo-700 border-indigo-200 bg-indigo-50/50">
            <BarChart2 className="h-4 w-4" /> View Overall Analytics
          </Button>

          {routesAccess.can_edit && (
            <Button onClick={handleCreateNew} className="gap-2">
              <Plus className="h-4 w-4" /> Create & Assign Route
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-md border bg-card flex flex-col">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b">
              <tr>
                <th className="px-6 py-3 font-medium">Sales Executive</th>
                <th className="px-6 py-3 font-medium">Assigned Routes</th>
                <th className="px-6 py-3 font-medium">Total Villages</th>
                <th className="px-6 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="text-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                  </td>
                </tr>
              ) : seList.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-12 text-muted-foreground">
                    No SEs found.
                  </td>
                </tr>
              ) : (
                paginatedList.map((se) => {
                  let totalCount = 0;

                  se.routes.forEach((r: any) => {
                    if (r.is_custom_others) {
                      totalCount += (r.locations?.[0]?.villages?.length || 0);
                    } else {
                      r.locations?.forEach((loc: any) => {
                        totalCount += (loc.villages?.length || 0);
                      });
                    }
                  });

                  return (
                    <tr key={se.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-6 py-4 font-medium flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        {se.name || 'Unnamed SE'}
                      </td>
                      <td className="px-6 py-4">
                        {se.routes.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {se.routes.map((r: any) => (
                              <span 
                                key={r.id} 
                                className={`text-xs px-2 py-1 rounded-md font-medium border ${
                                  r.is_custom_others 
                                    ? 'bg-amber-50 text-amber-700 border-amber-200' 
                                    : 'bg-primary/10 text-primary border-transparent'
                                }`}
                              >
                                {r.name}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">No routes assigned</span>
                        )}
                      </td>
                      
                      <td className="px-6 py-4">
                        <div className="font-semibold text-foreground text-base">
                          {totalCount}
                        </div>
                      </td>
                      
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="outline" size="sm" className="text-primary hover:text-primary border-primary/20 bg-primary/5" onClick={() => setSelectedViewSE(se)}>
                            View Territories
                          </Button>

                          {routesAccess.can_edit && (
                            <Button variant="ghost" size="sm" onClick={() => setSelectedSheetSE(se)}>
                              Manage Routes
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {seList.length > 0 && (
        <div className="flex items-center justify-between px-6 py-3 border-t bg-muted/20">
          <div className="text-sm text-muted-foreground">
            Showing <span className="font-medium">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> to <span className="font-medium">{Math.min(currentPage * ITEMS_PER_PAGE, seList.length)}</span> of <span className="font-medium">{seList.length}</span> entries
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="gap-1">
              <ChevronLeft className="h-4 w-4" /><span className="hidden sm:inline">Previous</span>
            </Button>
            <div className="text-sm font-medium px-2">Page {currentPage} of {totalPages}</div>
            <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages || totalPages === 0} className="gap-1">
              <span className="hidden sm:inline">Next</span><ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <RouteBuilderDialog open={isBuilderOpen} onOpenChange={setIsBuilderOpen} onSuccess={fetchSEsAndRoutes} editData={editData} />

      <SERoutesSheet 
        se={selectedSheetSE} open={!!selectedSheetSE} onOpenChange={(o) => !o && setSelectedSheetSE(null)}
        onEditRoute={openEditDialog} onUnassignRoute={handleUnassignRoute} canEdit={routesAccess.can_edit}
      />

      <TerritoryViewSheet se={selectedViewSE} open={!!selectedViewSE} onClose={() => setSelectedViewSE(null)} />

      <Dialog open={isAnalyticsOpen} onOpenChange={setIsAnalyticsOpen}>
        <DialogContent className="max-w-[95vw] w-full max-h-[95vh] overflow-hidden flex flex-col p-0">
          <DialogHeader className="px-6 py-4 border-b bg-muted/30 shrink-0">
            <DialogTitle className="flex items-center gap-2 text-xl">
              <BarChart2 className="h-6 w-6 text-indigo-600" /> Overall Executive Performance
            </DialogTitle>
            <DialogDescription>Performance metrics grouped by Sales Executive.</DialogDescription>
          </DialogHeader>
          
          <div className="p-6 overflow-auto flex-1 bg-slate-50">
            {analyticsLoading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground">Compiling global data...</p>
              </div>
            ) : analyticsData.length === 0 ? (
              <div className="text-center py-16 bg-white border border-dashed rounded-lg">
                <p className="text-muted-foreground font-medium">No active territory data found.</p>
              </div>
            ) : (
              <AnalyticsTable entities={analyticsData} />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default RoutesPage;