import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import AppLayout from '@/components/AppLayout';
import FarmerTable, { FarmerRow } from '@/components/FarmerTable';
import FarmerDetailSheet from '@/components/FarmerDetailSheet';
import { Loader2, FileSpreadsheet, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props { onLogout: () => void; }

const FarmersPage = ({ onLogout }: Props) => {
  const [rows, setRows] = useState<FarmerRow[]>([]);
  const [filteredData, setFilteredData] = useState<FarmerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<FarmerRow | null>(null);
  const [seList, setSeList] = useState<{ value: string; label: string }[]>([]);
  const { toast } = useToast();

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
            // === NEW MAP: Pass all draft data to the Edit Sheet ===
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
      setFilteredData(combined as any); // Initialize with all rows
      setLoading(false);
    })();
  }, [toast]);

  const handleExportExcel = () => {
    // 1. Added 'Sr. No.' to the headers
    const headers = ['Sr. No.', 'Full Name', 'Mobile', 'Village', 'Taluka', 'District', 'Onboarded By', 'Date Onboarded', 'Status'];
    const csvRows = [headers.join(',')];
    
    // 2. Added index to the forEach loop
    filteredData.forEach((row, index) => {
      csvRows.push([
        `"${index + 1}"`, // Sequential number starting from 1
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

  const handleExportPDF = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    // 1. Added index parameter and a <td> for the Sr. No.
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
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="text-lg font-semibold mb-1">Farmer Directory</h2>
            <p className="text-sm text-muted-foreground">
              {(rows || []).length} total records onboarded by field SEs.
            </p>
          </div>
          
          {!loading && (
            <div className="flex items-center gap-2 shrink-0">
              <Button 
                variant="outline" 
                size="sm" 
                className="gap-2 text-green-700 hover:text-green-800"
                onClick={handleExportExcel}
              >
                <FileSpreadsheet className="h-4 w-4" /> Excel (CSV)
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
          <FarmerTable 
            rows={rows} 
            onSelect={setSelected} 
            seOptions={seList} 
            onFilteredDataChange={setFilteredData} 
          />
        )}
      </div>
      <FarmerDetailSheet farmer={selected} open={!!selected} onClose={() => setSelected(null)} />
    </AppLayout>
  );
};

export default FarmersPage;