import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/AppLayout';
import FarmerTable, { FarmerRow } from '@/components/FarmerTable';
import FarmerDetailSheet from '@/components/FarmerDetailSheet';
import FarmerMapView from '@/components/FarmerMapView'; 
import { Loader2, FileSpreadsheet, FileText, Map, List, Shield, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'; 
import { usePermissions } from '@/hooks/usePermissions';

interface Props { onLogout: () => void; }

const FarmersPage = ({ onLogout }: Props) => {
  const [rows, setRows] = useState<FarmerRow[]>([]);
  const [filteredData, setFilteredData] = useState<FarmerRow[]>([]);
  const [loading, setLoading] = useState(true); 
  const [selected, setSelected] = useState<FarmerRow | null>(null);
  const [seList, setSeList] = useState<{ value: string; label: string }[]>([]);
  const [viewMode, setViewMode] = useState<'table' | 'map'>('table'); 
  const { toast } = useToast();
  
  const { session, loading: authLoading } = useAuth();
  const userId = session?.user?.id;
  
  const { getModulePerm, loading: permLoading } = usePermissions(userId || '');
  const [villageToSE, setVillageToSE] = useState<Record<string, string>>({});
  const [villageToRoute, setVillageToRoute] = useState<Record<string, string>>({});
  const farmerAccess = getModulePerm('farmers');

  const fetchVillageMapping = async () => {
    const { data, error } = await supabase.from('routes').select('name, locations');
    if (error) return;

    if (data) {
      const mapping: Record<string, string> = {};
      data.forEach((route: any) => {
        const routeName = route.name;
        (route.locations || []).forEach((loc: any) => {
          loc.villages?.forEach((village: string) => {
            mapping[village.trim().toLowerCase()] = routeName; 
          });
        });
      });
      setVillageToRoute(mapping);
    }
  };

  useEffect(() => {
    fetchVillageMapping();
    
    (async () => {
      // 1. Fetch SE Profiles for Filters
      const { data: seData } = await supabase.from('profiles').select('name').eq('role', 'SE');
      if (seData) {
        const uniqueNames = Array.from(new Set(seData.map(se => se.name).filter(Boolean)));
        setSeList(uniqueNames.map(name => ({ value: name as string, label: name as string })));
      }

      // 🚀 2. NEW: Fetch ALL Farm Cards directly from the actual table to establish Ground Truth
      const { data: farmCardsData } = await (supabase as any).from('farm_cards').select('farmer_id');
      // Put all farmer IDs into a Set for lightning-fast lookups
      const farmersWithCards = new Set((farmCardsData || []).map((fc: any) => fc.farmer_id));

      // 3. Chunked Fetch Loop for Farmers
      let allFarmers: any[] = [];
      let farmerPage = 0;
      const CHUNK_SIZE = 1000;
      let fetchMoreFarmers = true;

      while (fetchMoreFarmers) {
        const { data: farmerChunk, error: farmerError } = await supabase
          .from('farmers')
          .select('*, profiles:se_id(name)')
          .order('created_at', { ascending: false })
          .range(farmerPage * CHUNK_SIZE, (farmerPage + 1) * CHUNK_SIZE - 1);

        if (farmerError) {
          toast({ title: 'Failed to load farmers', description: farmerError.message, variant: 'destructive' });
          fetchMoreFarmers = false;
        } else if (farmerChunk && farmerChunk.length > 0) {
          allFarmers = [...allFarmers, ...farmerChunk];
          if (farmerChunk.length < CHUNK_SIZE) fetchMoreFarmers = false;
          else farmerPage++;
        } else {
          fetchMoreFarmers = false;
        }
      }

      // 4. Chunked Fetch Loop for Drafts
      let allDrafts: any[] = [];
      let draftPage = 0;
      let fetchMoreDrafts = true;

      while (fetchMoreDrafts) {
        const { data: draftChunk, error: draftError } = await supabase
          .from('drafts' as any)
          .select('*, profiles:se_id(name)')
          .eq('entity_type', 'farmer')
          .range(draftPage * CHUNK_SIZE, (draftPage + 1) * CHUNK_SIZE - 1);

        if (draftError) {
          fetchMoreDrafts = false;
        } else if (draftChunk && draftChunk.length > 0) {
          allDrafts = [...allDrafts, ...draftChunk];
          if (draftChunk.length < CHUNK_SIZE) fetchMoreDrafts = false;
          else draftPage++;
        } else {
          fetchMoreDrafts = false;
        }
      }

      // Format Drafts Data
      const formattedDrafts = allDrafts.map((draft: any) => {
        const d = draft.draft_data || {};
        return {
          id: draft.entity_id,
          se_id: draft.se_id,
          full_name: d.fullName || 'Incomplete Farmer',
          mobile: d.mobile || '—',
          village: d.village || '—',
          district: d.city || d.district || '—', 
          taluka: d.taluka || '—',
          status: 'DRAFT',
          created_at: draft.updated_at,
          profiles: draft.profiles,
          personal_details: { fatherName: d.fatherName, alternateMobile: d.alternateMobile, state: d.state, city: d.city, taluka: d.taluka, pincode: d.pincode },
          farm_details: {
            totalLand: d.totalLand, landUnit: d.landUnit, irrigatedLand: d.irrigatedLand, rainFedLand: d.rainFedLand,
            majorCrops: d.majorCrops, soilType: d.soilType, otherSoilType: d.otherSoilType, waterSource: d.waterSource,
            otherWaterSource: d.otherWaterSource, irrigationType: d.irrigationType, farmEquipments: d.farmEquipments,
            otherFarmEquipment: d.otherFarmEquipment, biofertilizer: d.biofertilizer, isIntercropping: d.isIntercropping,
            sideTrees: d.sideTrees, cattles: d.cattles
          },
          history_details: { pastCrops: d.pastCrops },
          fspp_details: d.fspp_details || {}
        };
      });

      // 5. Combine and dynamically assign the 100% accurate `has_farm_card` property
      const combined = [...allFarmers, ...formattedDrafts].map((row: any) => ({
        ...row,
        district: row.status === 'DRAFT' ? row.district : (row.personal_details?.city || '—'),
        taluka: row.status === 'DRAFT' ? row.taluka : (row.personal_details?.taluka || '—'),
        // 🚀 THE FIX: Cross-reference with our Farm Cards Set!
        has_farm_card: farmersWithCards.has(row.id)
      })).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setRows(combined as any);
      setFilteredData(combined as any); 
      setLoading(false);
    })();
  }, [toast]);

  if (authLoading || permLoading) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!farmerAccess.can_view) {
    return (
      <AppLayout onLogout={onLogout}>
        <div className="flex flex-col items-center justify-center h-[60vh] text-center">
          <Shield className="h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold">Access Denied</h2>
          <p className="text-muted-foreground">You do not have permission to view the farmer directory.</p>
        </div>
      </AppLayout>
    );
  }

  const handleExportExcel = () => {
    const headers = ['Sr. No.', 'Full Name', 'Mobile', 'Route Name', 'Village', 'Taluka', 'District', 'Onboarded By', 'Date Onboarded', 'Status'];
    const csvRows = [headers.join(',')];
    
    filteredData.forEach((row, index) => {
      const safeVillage = (row.village || '').trim().toLowerCase();
      const routeName = villageToRoute[safeVillage] || 'Unassigned';

      csvRows.push([
        `"${index + 1}"`, `"${row.full_name || ''}"`, `"${row.mobile || ''}"`, `"${routeName}"`, 
        `"${row.village || ''}"`, `"${row.taluka || ''}"`, `"${row.district || ''}"`, 
        `"${row.profiles?.name || ''}"`, `"${new Date(row.created_at).toLocaleDateString()}"`, `"${row.status || ''}"`
      ].join(','));
    });

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `farmers_export_${new Date().toISOString().split('T')[0]}.csv`; a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleExportFullDataCSV = () => {
    // Standard full CSV export logic goes here...
    // (Truncated for brevity, but keep your existing logic intact if you paste over it!)
  };

  const handleExportPDF = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const rowsHtml = filteredData.map((row, index) => {
      const safeVillage = (row.village || '').trim().toLowerCase();
      const assignedSeName = villageToSE[safeVillage] || 'Unassigned';

      return `<tr>
          <td>${index + 1}</td><td>${row.full_name || ''}</td><td>${row.mobile || ''}</td>
          <td>${row.village || ''}</td><td>${row.taluka || ''}</td><td>${row.district || ''}</td>
          <td>${row.profiles?.name || ''}</td><td><strong>${assignedSeName}</strong></td> 
          <td>${new Date(row.created_at).toLocaleDateString()}</td><td>${row.status || ''}</td>
      </tr>`;
    }).join('');
    
    printWindow.document.write(`
      <html>
        <head><title>Farmers Export</title><style>body { font-family: sans-serif; padding: 20px; } h2 { text-align: center; color: #333; } table { border-collapse: collapse; width: 100%; font-size: 11px; margin-top: 20px; } th, td { border: 1px solid #ddd; padding: 6px; text-align: left; } th { background-color: #f4f4f5; color: #333; }</style></head>
        <body>
          <h2>Farmers Directory Export</h2><p>Export Date: ${new Date().toLocaleDateString()}</p>
          <table><thead><tr><th>Sr. No.</th><th>Full Name</th><th>Mobile</th><th>Village</th><th>Taluka</th><th>District</th><th>Onboarded By</th><th>Assigned SE</th><th>Date Onboarded</th><th>Status</th></tr></thead><tbody>${rowsHtml}</tbody></table>
          <script>setTimeout(() => { window.print(); window.close(); }, 500);</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <AppLayout onLogout={onLogout}>
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-lg font-semibold mb-1">Farmer Directory</h2>
            <p className="text-sm text-muted-foreground">{(rows || []).length} total records onboarded by field SEs.</p>
          </div>
          
          {!loading && (
            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'table' | 'map')} className="w-[180px]">
                <TabsList className="grid w-full grid-cols-2 h-9">
                  <TabsTrigger value="table" className="text-xs"><List className="w-3.5 h-3.5 mr-1.5"/> Table</TabsTrigger>
                  <TabsTrigger value="map" className="text-xs"><Map className="w-3.5 h-3.5 mr-1.5"/> Map</TabsTrigger>
                </TabsList>
              </Tabs>
              <div className="h-6 w-px bg-border mx-1 hidden sm:block" />
              <Button variant="outline" size="sm" className="gap-2 text-green-700 hover:text-green-800" onClick={handleExportExcel}><FileSpreadsheet className="h-4 w-4" /> CSV</Button>
              <Button variant="outline" size="sm" className="gap-2 text-red-700 hover:text-red-800" onClick={handleExportPDF}><FileText className="h-4 w-4" /> PDF</Button>
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          viewMode === 'table' ? (
            <FarmerTable 
              rows={rows} 
              onSelect={setSelected} 
              seOptions={seList} 
              onFilteredDataChange={setFilteredData} 
              canEdit={farmerAccess.can_edit} 
              villageToRoute={villageToRoute}
            />
          ) : (
            <FarmerMapView data={filteredData} onViewDetails={setSelected} />
          )
        )}
      </div>
      <FarmerDetailSheet farmer={selected} open={!!selected} onClose={() => setSelected(null)} canEdit={farmerAccess.can_edit} />
    </AppLayout>
  );
};

export default FarmersPage;