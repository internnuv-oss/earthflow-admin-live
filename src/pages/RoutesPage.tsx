import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Loader2, Shield, Plus, User, ChevronLeft, ChevronRight } from 'lucide-react';
import { RouteBuilderDialog } from '@/components/RouteBuilderDialog';
import { SERoutesSheet } from '@/components/SERoutesSheet';

interface RoutesPageProps {
  onLogout: () => void;
}

const ITEMS_PER_PAGE = 10; // 🚀 You can change this to 15 or 20 if you prefer

const RoutesPage = ({ onLogout }: RoutesPageProps) => {
  const [seList, setSeList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // 🚀 NEW: Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  
  // Dialog/Sheet States
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [editData, setEditData] = useState<any | null>(null);
  const [selectedSheetSE, setSelectedSheetSE] = useState<any | null>(null);

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
    
    // 🚀 FIXED: Query profiles first to guarantee ALL SEs show up, even with 0 routes
    const { data, error } = await supabase
      .from('profiles')
      .select(`
        id,
        name,
        routes!routes_se_id_fkey (
          id,
          name,
          locations
        )
      `)
      .eq('role', 'SE')
      .order('name');

    if (error) {
      toast({ title: 'Failed to load routes', description: error.message, variant: 'destructive' });
    } else {
      // 🚀 FORMATTING: Map the data back into your component's exact expected shape
      const formatted = (data || []).map((se: any) => {
        const rawRoutes = se.routes || [];
        
        // 🚀 ALPHANUMERIC (NATURAL) SORT BY ROUTE NAME
        // This ensures R1, R10, R2 becomes R1, R2, R10
        const sortedRoutes = [...rawRoutes].sort((a: any, b: any) => 
          (a.name || '').localeCompare((b.name || ''), undefined, { numeric: true, sensitivity: 'base' })
        );

        return {
          id: se.id,
          name: se.name,
          routes: sortedRoutes 
        };
      });

      setSeList(formatted);
      setCurrentPage(1); // 🚀 Keeps pagination fully working and synchronized
      
      // Auto-update the slide-out sheet if it's currently open
      if (selectedSheetSE) {
        const updatedSE = formatted.find((s: any) => s.id === selectedSheetSE.id);
        if (updatedSE) setSelectedSheetSE(updatedSE);
      }
    }
    setLoading(false);
  };
  
  const handleUnassignRoute = async (routeId: string) => {
    if (!confirm('Are you sure you want to remove this route from the SE?')) return;
    
    const { error } = await supabase.from('routes').delete().eq('id', routeId);
    
    if (error) {
      toast({ title: 'Error deleting route', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Route Removed', description: 'The territory has been deleted successfully.' });
      fetchSEsAndRoutes();
    }
  };

  const openEditDialog = (route: any) => {
    setEditData({
      id: route.id,
      name: route.name,
      se_id: selectedSheetSE.id,
      locations: route.locations
    });
    setSelectedSheetSE(null);
    setIsBuilderOpen(true);
  };

  const handleCreateNew = () => {
    setEditData(null);
    setIsBuilderOpen(true);
  };

  if (authLoading || permLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
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

  // 🚀 NEW: Pagination Logic Variables
  const totalPages = Math.ceil(seList.length / ITEMS_PER_PAGE);
  const paginatedList = seList.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  return (
    <AppLayout onLogout={onLogout}>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold">Territory Routes</h2>
          <p className="text-sm text-muted-foreground">Manage service routes grouped by Sales Executive.</p>
        </div>
        
        {routesAccess.can_edit && (
  <Button onClick={handleCreateNew} className="gap-2">
    <Plus className="h-4 w-4" /> Create & Assign Route
  </Button>
)}
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
                <tr><td colSpan={4} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></td></tr>
              ) : seList.length === 0 ? (
                <tr><td colSpan={4} className="text-center py-12 text-muted-foreground">No SEs found.</td></tr>
              ) : (
                paginatedList.map((se) => {
                  const totalVillages = se.routes.reduce((sum: number, r: any) => sum + r.locations.reduce((lSum: number, loc: any) => lSum + (loc.villages?.length || 0), 0), 0);

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
                              <span key={r.id} className="bg-primary/10 text-primary text-xs px-2 py-1 rounded-md font-medium">
                                {r.name}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">No routes assigned</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">{totalVillages} Villages</td>
                      <td className="px-6 py-4 text-right">
  {se.routes.length > 0 ? (
    // 🚀 2. If they can view but NOT edit, change button text to "View Territories" 
    <Button variant="ghost" size="sm" onClick={() => setSelectedSheetSE(se)}>
      {routesAccess.can_edit ? 'View / Edit Routes' : 'View Territories'}
    </Button>
  ) : null}
</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 🚀 NEW: Pagination Controls Footer */}
        {seList.length > 0 && (
          <div className="flex items-center justify-between px-6 py-3 border-t bg-muted/20">
            <div className="text-sm text-muted-foreground">
              Showing <span className="font-medium">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> to <span className="font-medium">{Math.min(currentPage * ITEMS_PER_PAGE, seList.length)}</span> of <span className="font-medium">{seList.length}</span> entries
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="gap-1"
              >
                <ChevronLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Previous</span>
              </Button>
              <div className="text-sm font-medium px-2">
                Page {currentPage} of {totalPages}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages || totalPages === 0}
                className="gap-1"
              >
                <span className="hidden sm:inline">Next</span>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      <RouteBuilderDialog 
        open={isBuilderOpen} 
        onOpenChange={setIsBuilderOpen} 
        onSuccess={fetchSEsAndRoutes} 
        editData={editData}
      />

      <SERoutesSheet 
        se={selectedSheetSE}
        open={!!selectedSheetSE}
        onOpenChange={(o) => !o && setSelectedSheetSE(null)}
        onEditRoute={openEditDialog}
        onUnassignRoute={handleUnassignRoute}
        canEdit={routesAccess.can_edit}
      />
    </AppLayout>
  );
};

export default RoutesPage;