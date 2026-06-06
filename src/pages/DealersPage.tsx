import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import AppLayout from '@/components/AppLayout';
import DealerTable, { DealerRow } from '@/components/DealerTable';
import DealerDetailSheet from '@/components/DealerDetailSheet';
import { Loader2 } from 'lucide-react';

interface Props { onLogout: () => void; }

const DealersPage = ({ onLogout }: Props) => {
  const [rows, setRows] = useState<DealerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<DealerRow | null>(null);
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

      // 2. Fetch completed dealers
      const { data: dealersData, error: dealersError } = await supabase
        .from('dealers')
        .select('*, profiles:se_id(name)')
        .order('created_at', { ascending: false });

      if (dealersError) toast({ title: 'Failed to load', description: dealersError.message, variant: 'destructive' });

      // 3. Fetch dealer drafts
      const { data: draftsData } = await supabase
        .from('drafts' as any)
        .select('*, profiles:se_id(name)')
        .eq('entity_type', 'dealer');

      // 4. Format drafts
      const formattedDrafts = ((draftsData as any[]) || []).map((draft: any) => ({
        id: draft.entity_id,
        se_id: draft.se_id,
        primary_shop_name: draft.draft_data?.shopName || 'Incomplete Dealer',
        contact_person: draft.draft_data?.owners?.[0]?.name || '—',
        contact_mobile: draft.draft_data?.contactMobile || '—',
        primary_address: draft.draft_data?.address || '—',
        category: '—',
        status: 'DRAFT', 
        total_score: 0,
        created_at: draft.updated_at,
        profiles: draft.profiles
      }));

      // 5. Combine and sort newest first
      const combined = [...(dealersData || []), ...formattedDrafts].sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setRows(combined as any);
      setLoading(false);
    })();
  }, [toast]);

  return (
    <AppLayout onLogout={onLogout}>
      <div>
        <h2 className="text-lg font-semibold mb-1">Dealer Directory</h2>
        <p className="text-sm text-muted-foreground mb-4">
          {(rows || []).length} total records onboarded by field SEs.
        </p>
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <DealerTable rows={rows} onSelect={setSelected} seOptions={seList} />
        )}
      </div>
      <DealerDetailSheet dealer={selected} open={!!selected} onClose={() => setSelected(null)} />
    </AppLayout>
  );
};

export default DealersPage;