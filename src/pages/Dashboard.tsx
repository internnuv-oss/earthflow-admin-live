import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import KpiCard from '@/components/KpiCard';
import AppLayout from '@/components/AppLayout';
import { Users, Clock, Wheat, Truck, UserCog, CheckCircle2 } from 'lucide-react';

interface DashboardProps { onLogout: () => void; }

interface Counts {
  ses: number; sesComplete: number;
  distributors: number; distributorsPending: number;
  dealers: number; dealersPending: number;
  farmers: number; farmersPending: number;
}

const Dashboard = ({ onLogout }: DashboardProps) => {
  const [c, setC] = useState<Counts>({
    ses: 0, sesComplete: 0, distributors: 0, distributorsPending: 0,
    dealers: 0, dealersPending: 0, farmers: 0, farmersPending: 0,
  });

  useEffect(() => {
    (async () => {
      const head = { count: 'exact' as const, head: true };
      const [ses, sesC, dist, distP, deal, dealP, farm, farmP] = await Promise.all([
        supabase.from('profiles').select('id', head).eq('role', 'SE'),
        supabase.from('sales_executive').select('profile_id', head).eq('is_profile_complete', true),
        supabase.from('distributors').select('id', head),
        supabase.from('distributors').select('id', head).eq('status', 'DRAFT'),
        supabase.from('dealers').select('id', head),
        supabase.from('dealers').select('id', head).eq('status', 'DRAFT'),
        supabase.from('farmers').select('id', head),
        supabase.from('farmers').select('id', head).eq('status', 'DRAFT'),
      ]);
      setC({
        ses: ses.count || 0, sesComplete: sesC.count || 0,
        distributors: dist.count || 0, distributorsPending: distP.count || 0,
        dealers: deal.count || 0, dealersPending: dealP.count || 0,
        farmers: farm.count || 0, farmersPending: farmP.count || 0,
      });
    })();
  }, []);

  const totalPending = (c?.distributorsPending || 0) + (c?.dealersPending || 0) + (c?.farmersPending || 0);

  return (
    <AppLayout onLogout={onLogout}>
      <div>
        <h2 className="text-lg font-semibold mb-1">Overview</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Live command center across sales executives, distributors, dealers, and farmers.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <KpiCard title="Sales Executives" value={c.ses} icon={UserCog} description="Active SEs in territory" to="/sales-executives" />
        <KpiCard title="SE Profiles Complete" value={c.sesComplete} icon={CheckCircle2} description="Finished mobile onboarding" />
        <KpiCard title="Distributors" value={c.distributors} icon={Truck} description="View directory" to="/distributors" />
        <KpiCard title="Dealers" value={c.dealers} icon={Users} description="View directory" to="/dealers" />
        <KpiCard title="Farmers" value={c.farmers} icon={Wheat} description="View directory" to="/farmers" />
        <KpiCard title="Pending Approvals" value={totalPending} icon={Clock} description="Drafts across all directories" accent="muted" />
      </div>
    </AppLayout>
  );
};

export default Dashboard;
