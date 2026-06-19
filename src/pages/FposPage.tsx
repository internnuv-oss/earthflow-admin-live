import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import AppLayout from '@/components/AppLayout';
import FpoTable, { FpoRow } from '@/components/FpoTable';
import FpoDetailSheet from '@/components/FpoDetailSheet';
import { Loader2, FileSpreadsheet, FileText, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props { onLogout: () => void; }

const FposPage = ({ onLogout }: Props) => {
  // ==========================================
  // 1. ALL HOOKS MUST BE DECLARED FIRST
  // Absolutely no `if` statements or `return` statements above this section!
  // ==========================================
  const [rows, setRows] = useState<FpoRow[]>([]);
  const [filteredData, setFilteredData] = useState<FpoRow[]>([]);
  const [loading, setLoading] = useState(true); 
  const [selected, setSelected] = useState<FpoRow | null>(null);
  const [seList, setSeList] = useState<{ value: string; label: string }[]>([]);
  const { toast } = useToast();

  const { session, loading: authLoading } = useAuth();
  const userId = session?.user?.id;
  
  const { getModulePerm, loading: permLoading } = usePermissions(userId || '');
  const fpoAccess = getModulePerm('fpos');

  useEffect(() => {
    (async () => {
      // 1. Fetch all SEs for dropdowns
      const { data: seData } = await supabase.from('profiles').select('name').eq('role', 'SE');
      if (seData) {
        const uniqueNames = Array.from(new Set(seData.map(se => se.name).filter(Boolean)));
        setSeList(uniqueNames.map(name => ({ value: name as string, label: name as string })));
      }

      // 2. Fetch Submitted FPOs
      const { data: fposData, error } = await (supabase as any)
        .from('fpos')
        .select('*, profiles:se_id(name)')
        .order('created_at', { ascending: false });

      if (error) {
        toast({ title: 'Failed to load', description: error.message, variant: 'destructive' });
      }

      // 3. Fetch FPO Drafts
      const { data: draftsData } = await (supabase as any)
        .from('drafts')
        .select('*, profiles:se_id(name)')
        .eq('entity_type', 'fpo');

      const formattedDrafts = ((draftsData as any[]) || []).map((draft: any) => {
        const d = draft.draft_data || {};
        return {
          id: draft.entity_id,
          se_id: draft.se_id,
          fpo_name: d.fpoName || 'Incomplete FPO',
          contact_mobile: d.contactMobile || '—',
          city: d.city || '—', 
          state: d.state || '—',
          taluka: d.taluka || '—',
          registration_number: d.registrationNumber || '',
          ceo_name: d.ceoName || '',
          bod_president_name: d.bodPresidentName || '',
          email: d.email || '',
          gst_number: d.gstNumber || '',
          pan_number: d.panNumber || '',
          promoting_agency: d.promotingAgency || '',
          address: d.address || '',
          pincode: d.pincode || '',
          command_area: d.commandArea || '',
          status: 'DRAFT',
          created_at: draft.updated_at,
          profiles: draft.profiles,
          // Pass the JSON blocks for editing
          bank_details: { bankAccounts: d.bankAccounts },
          documents: d.documents,
          business_scope: d.business_scope || {},
          member_base: d.member_base || {},
          storage_locations: d.storage_locations || {},
          commitments: d.commitments || {},
          scoring: d.scoring || {}
        };
      });

      const combined = [...(fposData || []), ...formattedDrafts].sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setRows(combined as any);
      setFilteredData(combined as any);
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

  if (!fpoAccess.can_view) {
    return (
      <AppLayout onLogout={onLogout}>
        <div className="flex flex-col items-center justify-center h-[60vh] text-center">
          <Shield className="h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold">Access Denied</h2>
          <p className="text-muted-foreground">You do not have permission to view the FPO directory.</p>
        </div>
      </AppLayout>
    );
  }

  // ==========================================
  // 3. EXPORT FUNCTIONS & MAIN RETURN
  // ==========================================
  const handleExportExcel = () => {
    const headers = ['Sr. No.', 'FPO Name', 'Reg Number', 'Contact Mobile', 'City', 'State', 'CEO Name', 'Onboarded By', 'Date', 'Status'];
    const csvRows = [headers.join(',')];
    
    filteredData.forEach((row, index) => {
      csvRows.push([
        `"${index + 1}"`,
        `"${row.fpo_name || ''}"`,
        `"${row.registration_number || ''}"`,
        `"${row.contact_mobile || ''}"`,
        `"${row.city || ''}"`,
        `"${row.state || ''}"`,
        `"${row.ceo_name || ''}"`,
        `"${row.profiles?.name || ''}"`,
        `"${new Date(row.created_at).toLocaleDateString()}"`,
        `"${row.status || ''}"`
      ].join(','));
    });

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fpos_export_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleExportPDF = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const rowsHtml = filteredData.map((row, index) => `<tr>
        <td>${index + 1}</td>
        <td>${row.fpo_name || ''}</td>
        <td>${row.registration_number || ''}</td>
        <td>${row.contact_mobile || ''}</td>
        <td>${row.city || ''}</td>
        <td>${row.state || ''}</td>
        <td>${row.profiles?.name || ''}</td>
        <td>${new Date(row.created_at).toLocaleDateString()}</td>
        <td>${row.status || ''}</td>
    </tr>`).join('');
    
    printWindow.document.write(`
      <html>
        <head>
          <title>FPOs Export</title>
          <style>
            body { font-family: sans-serif; padding: 20px; }
            h2 { text-align: center; color: #333; }
            table { border-collapse: collapse; width: 100%; font-size: 12px; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f4f4f5; color: #333; }
          </style>
        </head>
        <body>
          <h2>FPO Directory Export</h2>
          <p>Export Date: ${new Date().toLocaleDateString()}</p>
          <table>
            <thead>
              <tr>
                <th>Sr. No.</th><th>FPO Name</th><th>Reg #</th><th>Contact</th><th>City</th>
                <th>State</th><th>Onboarded By</th><th>Date</th><th>Status</th>
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
            <h2 className="text-lg font-semibold mb-1">FPO Directory</h2>
            <p className="text-sm text-muted-foreground">
              {(rows || []).length} total FPOs onboarded by field SEs.
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
          <FpoTable rows={rows} onSelect={setSelected} seOptions={seList} onFilteredDataChange={setFilteredData} />
        )}
      </div>
      <FpoDetailSheet fpo={selected} open={!!selected} onClose={() => setSelected(null)} onSaved={() => window.location.reload()} />
    </AppLayout>
  );
};

export default FposPage;