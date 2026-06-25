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
  // ==========================================
  // 1. ALL HOOKS AT THE VERY TOP
  // ==========================================
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
  const farmerAccess = getModulePerm('farmers');

  useEffect(() => {
    (async () => {
      const { data: seData } = await supabase
        .from('profiles')
        .select('name')
        .eq('role', 'SE');
      
      if (seData) {
        const uniqueNames = Array.from(new Set(seData.map(se => se.name).filter(Boolean)));
        setSeList(uniqueNames.map(name => ({ value: name as string, label: name as string })));
      }

      const { data: farmersData, error } = await supabase
        .from('farmers')
        .select('*, profiles:se_id(name)')
        .order('created_at', { ascending: false });

      if (error) toast({ title: 'Failed to load', description: error.message, variant: 'destructive' });

      const { data: draftsData } = await supabase
        .from('drafts' as any)
        .select('*, profiles:se_id(name)')
        .eq('entity_type', 'farmer');

      const formattedDrafts = ((draftsData as any[]) || []).map((draft: any) => {
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
          personal_details: {
            fatherName: d.fatherName, alternateMobile: d.alternateMobile,
            state: d.state, city: d.city, taluka: d.taluka, pincode: d.pincode
          },
          farm_details: {
            totalLand: d.totalLand, landUnit: d.landUnit, irrigatedLand: d.irrigatedLand, rainFedLand: d.rainFedLand,
            majorCrops: d.majorCrops, soilType: d.soilType, otherSoilType: d.otherSoilType, waterSource: d.waterSource,
            otherWaterSource: d.otherWaterSource, irrigationType: d.irrigationType, farmEquipments: d.farmEquipments,
            otherFarmEquipment: d.otherFarmEquipment, biofertilizer: d.biofertilizer, isIntercropping: d.isIntercropping,
            sideTrees: d.sideTrees, cattles: d.cattles
          },
          history_details: { pastCrops: d.pastCrops }
        };
      });

      const combined = [...(farmersData || []), ...formattedDrafts].map((row: any) => ({
        ...row,
        district: row.status === 'DRAFT' ? row.district : (row.personal_details?.city || '—'),
        taluka: row.status === 'DRAFT' ? row.taluka : (row.personal_details?.taluka || '—'),
      })).sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setRows(combined as any);
      setFilteredData(combined as any); 
      setLoading(false);
    })();
  }, [toast]);

  // ==========================================
  // 2. SAFE EARLY RETURNS
  // ==========================================
  if (authLoading || permLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
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

  // ==========================================
  // 3. EXPORT FUNCTIONS & MAIN RENDER
  // ==========================================
  const handleExportExcel = () => {
    const headers = ['Sr. No.', 'Full Name', 'Mobile', 'Village', 'Taluka', 'District', 'Onboarded By', 'Date Onboarded', 'Status'];
    const csvRows = [headers.join(',')];
    
    filteredData.forEach((row, index) => {
      csvRows.push([
        `"${index + 1}"`,
        `"${row.full_name || ''}"`,
        `"${row.mobile || ''}"`,
        `"${row.village || ''}"`,
        `"${row.taluka || ''}"`,
        `"${row.district || ''}"`,
        `"${row.profiles?.name || ''}"`,
        `"${new Date(row.created_at).toLocaleDateString()}"`,
        `"${row.status || ''}"`
      ].join(','));
    });

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `farmers_export_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

// 🚀 NEW: Fully Dynamic Flattened Export (Auto-detects all trees, cattle, and crops!)
const handleExportFullDataCSV = () => {
  // 1. PRE-SCAN THE DATA: Find all unique dropdown values used by your farmers
  const cattleTypes = new Set<string>();
  const treeTypes = new Set<string>();
  let maxPastCrops = 0;

  filteredData.forEach(row => {
    const fd = row.farm_details || {};
    const hd = row.history_details || {};

    if (Array.isArray(fd.cattles)) {
      fd.cattles.forEach((c: any) => { if (c.type) cattleTypes.add(c.type); });
    }
    if (Array.isArray(fd.sideTrees)) {
      fd.sideTrees.forEach((t: any) => { if (t.type) treeTypes.add(t.type); });
    }
    if (Array.isArray(hd.pastCrops) && hd.pastCrops.length > maxPastCrops) {
      maxPastCrops = hd.pastCrops.length;
    }
  });

  const uniqueCattles = Array.from(cattleTypes).sort();
  const uniqueTrees = Array.from(treeTypes).sort();

  // 2. BUILD DYNAMIC HEADERS
  const headers = [
    'Sr. No.', 'Status', 'Onboarded By', 'Date Onboarded', 'Full Name', 'Mobile',
    'Alternate Mobile', 'Father Name', 'Village', 'Taluka', 'District/City', 'State',
    'Pincode', 'Total Land', 'Land Unit', 'Irrigated Land', 'Rain Fed Land',
    'Major Crops', 'Soil Type', 'Water Source', 'Irrigation Type', 'Farm Equipments',
    'Biofertilizer Used', 'Is Intercropping'
  ];

  // Auto-generate a column for EVERY cattle type found
  uniqueCattles.forEach(c => headers.push(`Cattle: ${c} (Qty)`));
  
  // Auto-generate a column for EVERY tree type found
  uniqueTrees.forEach(t => headers.push(`Trees: ${t} (Qty)`));

  // Auto-generate grouped columns up to the maximum past crops anyone has
  for (let i = 1; i <= maxPastCrops; i++) {
    headers.push(
      `Past Crop ${i}: Name`, 
      `Past Crop ${i}: Area`, 
      `Past Crop ${i}: Area Unit`, 
      `Past Crop ${i}: Yield`, 
      `Past Crop ${i}: Yield Unit`, 
      `Past Crop ${i}: Inputs Used`,
      `Past Crop ${i}: Problems Faced`
    );
  }

  // 3. HELPERS
  const escape = (val: any) => {
    if (val === null || val === undefined || val === '') return '""';
    const str = String(val).replace(/"/g, '""'); 
    return `"${str}"`;
  };
  const joinArray = (arr: any) => Array.isArray(arr) ? arr.join('; ') : arr || '';
  const getQuantity = (arr: any, typeName: string) => {
    if (!Array.isArray(arr)) return '0';
    const item = arr.find((obj: any) => obj.type === typeName);
    return item ? item.quantity : '0';
  };

  const csvRows = [headers.join(',')];
  
  // 4. MAP THE DATA TO THE DYNAMIC COLUMNS
  filteredData.forEach((row, index) => {
    const pd = row.personal_details || {};
    const fd = row.farm_details || {};
    const hd = row.history_details || {};

    // Start with standard base data
    const baseRow = [
      escape(index + 1),
      escape(row.status || 'SUBMITTED'),
      escape(row.profiles?.name || '—'),
      escape(new Date(row.created_at).toLocaleDateString()),
      escape(row.full_name),
      escape(row.mobile),
      escape(pd.alternateMobile),
      escape(pd.fatherName),
      escape(row.village || pd.village),
      escape(pd.taluka),
      escape(pd.city),
      escape(pd.state),
      escape(pd.pincode),
      escape(fd.totalLand),
      escape(fd.landUnit),
      escape(fd.irrigatedLand),
      escape(fd.rainFedLand),
      escape(joinArray(fd.majorCrops)),
      escape(joinArray(fd.soilType)),
      escape(joinArray(fd.waterSource)),
      escape(joinArray(fd.irrigationType)),
      escape(joinArray(fd.farmEquipments)),
      escape(fd.biofertilizer),
      escape(fd.isIntercropping)
    ];

    // Add Dynamic Cattle Quantities
    uniqueCattles.forEach(c => baseRow.push(escape(getQuantity(fd.cattles, c))));

    // Add Dynamic Tree Quantities
    uniqueTrees.forEach(t => baseRow.push(escape(getQuantity(fd.sideTrees, t))));

    // Add Dynamic Past Crops
    const pastCropsArray = Array.isArray(hd.pastCrops) ? hd.pastCrops : [];
    for (let i = 0; i < maxPastCrops; i++) {
      const crop = pastCropsArray[i] || {};
      baseRow.push(
        escape(crop.cropName || ''),
        escape(crop.area || ''),
        escape(crop.areaUnit || ''),
        escape(crop.yield || ''),
        escape(crop.yieldUnit || ''),
        escape(joinArray(crop.inputUsed)),
        escape(crop.problemsFaced || '')
      );
    }

    csvRows.push(baseRow.join(','));
  });

  // 5. GENERATE FILE
  const blob = new Blob(['\uFEFF' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `farmers_dynamic_analytics_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  window.URL.revokeObjectURL(url);
};

  const handleExportPDF = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const rowsHtml = filteredData.map((row, index) => `<tr>
        <td>${index + 1}</td>
        <td>${row.full_name || ''}</td>
        <td>${row.mobile || ''}</td>
        <td>${row.village || ''}</td>
        <td>${row.taluka || ''}</td>
        <td>${row.district || ''}</td>
        <td>${row.profiles?.name || ''}</td>
        <td>${new Date(row.created_at).toLocaleDateString()}</td>
        <td>${row.status || ''}</td>
    </tr>`).join('');
    
    printWindow.document.write(`
      <html>
        <head>
          <title>Farmers Export</title>
          <style>
            body { font-family: sans-serif; padding: 20px; }
            h2 { text-align: center; color: #333; }
            table { border-collapse: collapse; width: 100%; font-size: 12px; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f4f4f5; color: #333; }
          </style>
        </head>
        <body>
          <h2>Farmers Directory Export</h2>
          <p>Export Date: ${new Date().toLocaleDateString()}</p>
          <table>
            <thead>
              <tr>
                <th>Sr. No.</th><th>Full Name</th><th>Mobile</th><th>Village</th><th>Taluka</th>
                <th>District</th><th>Onboarded By</th><th>Date Onboarded</th><th>Status</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
          <script>
            setTimeout(() => { window.print(); window.close(); }, 500);
          </script>
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
            <p className="text-sm text-muted-foreground">
              {(rows || []).length} total records onboarded by field SEs.
            </p>
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

              <Button 
                variant="outline" 
                size="sm" 
                className="gap-2 text-green-700 hover:text-green-800"
                onClick={handleExportExcel}
              >
                <FileSpreadsheet className="h-4 w-4" /> CSV
              </Button>
              {/* 🚀 NEW Full Data CSV Button */}
              <Button 
                variant="outline" 
                size="sm" 
                className="gap-2 text-blue-700 hover:text-blue-800"
                onClick={handleExportFullDataCSV}
              >
                <Download className="h-4 w-4" /> Full Data CSV
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="gap-2 text-red-700 hover:text-red-800"
                onClick={handleExportPDF}
              >
                <FileText className="h-4 w-4" /> PDF
              </Button>
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
            />
          ) : (
            <FarmerMapView 
              data={filteredData} 
              onViewDetails={setSelected} 
            />
          )
        )}
      </div>
      <FarmerDetailSheet 
        farmer={selected} 
        open={!!selected} 
        onClose={() => setSelected(null)} 
        canEdit={farmerAccess.can_edit} 
      />
    </AppLayout>
  );
};

export default FarmersPage;
