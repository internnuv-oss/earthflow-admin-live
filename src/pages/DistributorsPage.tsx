import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import AppLayout from '@/components/AppLayout';
import DistributorTable, { DistributorRow } from '@/components/DistributorTable';
import DistributorDetailSheet from '@/components/DistributorDetailSheet';
import { Loader2 } from 'lucide-react';

interface Props { onLogout: () => void; }

const DistributorsPage = ({ onLogout }: Props) => {
  const [rows, setRows] = useState<DistributorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<DistributorRow | null>(null);
  const [seList, setSeList] = useState<{ value: string; label: string }[]>([]);
  const { toast } = useToast();

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
      setLoading(false);
    })();
  }, [toast]);

  return (
    <AppLayout onLogout={onLogout}>
      <div>
        <h2 className="text-lg font-semibold mb-1">Distributor Directory</h2>
        <p className="text-sm text-muted-foreground mb-4">
          {(rows || []).length} total records onboarded by field SEs.
        </p>
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <DistributorTable rows={rows} onSelect={setSelected} seOptions={seList} />
        )}
      </div>
      <DistributorDetailSheet distributor={selected} open={!!selected} onClose={() => setSelected(null)} />
    </AppLayout>
  );
};

export default DistributorsPage;