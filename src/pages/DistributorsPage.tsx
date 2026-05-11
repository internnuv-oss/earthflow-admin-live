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
  const { toast } = useToast();

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('distributors')
        .select('*, profiles:se_id(name)')
        .order('created_at', { ascending: false });
      if (error) toast({ title: 'Failed to load', description: error.message, variant: 'destructive' });
      setRows((data || []) as any);
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
          <DistributorTable rows={rows} onSelect={setSelected} />
        )}
      </div>
      <DistributorDetailSheet distributor={selected} open={!!selected} onClose={() => setSelected(null)} />
    </AppLayout>
  );
};

export default DistributorsPage;
