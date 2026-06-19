import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import AppLayout from '@/components/AppLayout';
import DistributorTable, { DistributorRow } from '@/components/DistributorTable';
import DistributorDetailSheet from '@/components/DistributorDetailSheet';
import { Loader2, Shield, FileSpreadsheet, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props { onLogout: () => void; }

const DistributorsPage = ({ onLogout }: Props) => {
  // ==========================================
  // 1. ALL HOOKS MUST BE AT THE VERY TOP
  // ==========================================
  const [rows, setRows] = useState<DistributorRow[]>([]);
  const [filteredData, setFilteredData] = useState<DistributorRow[]>([]); // Added for exports
  const [loading, setLoading] = useState(true); 
  const [selected, setSelected] = useState<DistributorRow | null>(null);
  const [seList, setSeList] = useState<{ value: string; label: string }[]>([]);
  const { toast } = useToast();

  const { session, loading: authLoading } = useAuth();
  const userId = session?.user?.id;
  
  const { getModulePerm, loading: permLoading } = usePermissions(userId || '');
  const distributorAccess = getModulePerm('distributors');

  useEffect(() => {
    (async () => {
      // 1. Fetch all SEs from profiles table to populate the filter dropdown
      const { data: seData } = await supabase
        .from('profiles')
        .select('name')
        .eq('role', 'SE');
      
      if (seData) {
        const uniqueNames = Array.from(new Set(seData.map(se => se.name).filter(Boolean)));
        setSeList(uniqueNames.map(name => ({ value: name as string, label: name as string })));
      }

      // 2. Fetch completed distributors
      const { data: distData, error } = await supabase
        .from('distributors')
        .select('*, profiles:se_id(name)')
        .order('created_at', { ascending: false });

      if (error) toast({ title: 'Failed to load', description: error.message, variant: 'destructive' });

      // 3. Fetch distributor drafts
      const { data: draftsData } = await supabase
        .from('drafts' as any)
        .select('*, profiles:se_id(name)')
        .eq('entity_type', 'distributor');

      // 4. Format drafts
      const formattedDrafts = ((draftsData as any[]) || []).map((draft: any) => ({
        id: draft.entity_id,
        se_id: draft.se_id,
        firm_name: draft.draft_data?.firmName || 'Incomplete Distributor',
        contact_person: draft.draft_data?.contactPerson || '—',
        contact_mobile: draft.draft_data?.contactMobile || '—',
        city: draft.draft_data?.city || '—',
        status: 'DRAFT',
        total_score: 0,
        band: '—',
        created_at: draft.updated_at,
        profiles: draft.profiles
      }));

      // 5. Combine and sort newest first
      const combined = [...(distData || []), ...formattedDrafts].sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setRows(combined as any);
      setFilteredData(combined as any); // Set initial filtered data
      setLoading(false);
    })();
  }, [toast]);

  // ==========================================
  // 2. NOW IT IS SAFE TO DO EARLY RETURNS
  // ==========================================
  if (authLoading || permLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!distributorAccess.can_view) {
    return (
      <AppLayout onLogout={onLogout}>
        <div className="flex flex-col items-center justify-center h-[60vh] text-center">
          <Shield className="h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold">Access Denied</h2>
          <p className="text-muted-foreground">You do not have permission to view the distributor directory.</p>
        </div>
      </AppLayout>
    );
  }

  // ==========================================
  // 3. EXPORT FUNCTIONS & MAIN RETURN
  // ==========================================
  const handleExportExcel = () => {
    const headers = ['Sr. No.', 'Firm Name', 'Contact Person', 'Mobile', 'City', 'Band', 'Onboarded By', 'Date', 'Status'];
    const csvRows = [headers.join(',')];
    
    filteredData.forEach((row, index) => {
      csvRows.push([
        `"${index + 1}"`,
        `"${row.firm_name || ''}"`,
        `"${row.contact_person || ''}"`,
        `"${row.contact_mobile || ''}"`,
        `"${row.city || ''}"`,
        `"${row.band || ''}"`,
        `"${row.profiles?.name || ''}"`,
        `"${new Date(row.created_at).toLocaleDateString()}"`,
        `"${row.status || ''}"`
      ].join(','));
    });

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `distributors_export_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleExportPDF = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const rowsHtml = filteredData.map((row, index) => `<tr>
        <td>${index + 1}</td>
        <td>${row.firm_name || ''}</td>
        <td>${row.contact_person || ''}</td>
        <td>${row.contact_mobile || ''}</td>
        <td>${row.city || ''}</td>
        <td>${row.band || ''}</td>
        <td>${row.profiles?.name || ''}</td>
        <td>${new Date(row.created_at).toLocaleDateString()}</td>
        <td>${row.status || ''}</td>
    </tr>`).join('');
    
    printWindow.document.write(`
      <html>
        <head>
          <title>Distributors Export</title>
          <style>
            body { font-family: sans-serif; padding: 20px; }
            h2 { text-align: center; color: #333; }
            table { border-collapse: collapse; width: 100%; font-size: 12px; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f4f4f5; color: #333; }
          </style>
        </head>
        <body>
          <h2>Distributor Directory Export</h2>
          <p>Export Date: ${new Date().toLocaleDateString()}</p>
          <table>
            <thead>
              <tr>
                <th>Sr. No.</th><th>Firm Name</th><th>Contact Person</th><th>Mobile</th>
                <th>City</th><th>Band</th><th>Onboarded By</th><th>Date</th><th>Status</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
          <script>setTimeout(() => { window.print(); window.close(); }, 500);</script>
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
            <h2 className="text-lg font-semibold mb-1">Distributor Directory</h2>
            <p className="text-sm text-muted-foreground">
              {(rows || []).length} total records onboarded by field SEs.
            </p>
          </div>

          {!loading && (
            <div className="flex items-center gap-2 shrink-0">
              <Button variant="outline" size="sm" className="gap-2 text-green-700 hover:text-green-800" onClick={handleExportExcel}>
                <FileSpreadsheet className="h-4 w-4" /> Excel (CSV)
              </Button>
              <Button variant="outline" size="sm" className="gap-2 text-red-700 hover:text-red-800" onClick={handleExportPDF}>
                <FileText className="h-4 w-4" /> PDF
              </Button>
            </div>
          )}
        </div>
        
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <DistributorTable 
            rows={rows} 
            onSelect={setSelected} 
            seOptions={seList} 
            onFilteredDataChange={setFilteredData} 
          />
        )}
      </div>
      <DistributorDetailSheet distributor={selected} open={!!selected} onClose={() => setSelected(null)} />
    </AppLayout>
  );
};

export default DistributorsPage;