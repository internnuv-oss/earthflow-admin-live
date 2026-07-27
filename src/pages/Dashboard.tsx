// src/pages/Dashboard.tsx

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import KpiCard from '@/components/KpiCard';
import AppLayout from '@/components/AppLayout';
import AdminUserManagement from '@/components/AdminUserManagement';
import { Users, Clock, Wheat, Truck, UserCog, CheckCircle2, Loader2, Shield } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth'; 
import { usePermissions } from '@/hooks/usePermissions';

interface DashboardProps { onLogout: () => void; }

interface Counts {
  ses: number; sesComplete: number;
  distributors: number; distributorsPending: number;
  dealers: number; dealersPending: number;
  farmers: number; farmersPending: number;
}

const Dashboard = ({ onLogout }: DashboardProps) => {
  const { session, role, loading: authLoading } = useAuth(); 

  const { getModulePerm, loading: permLoading } = usePermissions(session?.user?.id);
  const dashboardAccess = getModulePerm('dashboard');
  
  const [c, setC] = useState<Counts>({
    ses: 0, sesComplete: 0, distributors: 0, distributorsPending: 0,
    dealers: 0, dealersPending: 0, farmers: 0, farmersPending: 0,
  });

  useEffect(() => {
    (async () => {
      const head = { count: 'exact' as const, head: true };
      
      // Fetch submitted profiles + explicitly fetch from the new `drafts` table
      const [
        ses, sesC, 
        dist, deal, farm, 
        draftDist, draftDeal, draftFarm
      ] = await Promise.all([
        supabase.from('profiles').select('id', head).eq('role', 'SE'),
        supabase.from('sales_executive').select('profile_id', head).eq('is_profile_complete', true),
        supabase.from('distributors').select('id', head),
        supabase.from('dealers').select('id', head),
        supabase.from('farmers').select('id', head),
        supabase.from('drafts').select('id', head).eq('entity_type', 'distributor'),
        supabase.from('drafts').select('id', head).eq('entity_type', 'dealer'),
        supabase.from('drafts').select('id', head).eq('entity_type', 'farmer'),
      ]);

      // Combine Main Tables (Submitted) + Drafts Table (Pending)
      setC({
        ses: ses.count || 0, 
        sesComplete: sesC.count || 0,
        distributors: (dist.count || 0) + (draftDist.count || 0), 
        distributorsPending: draftDist.count || 0,
        dealers: (deal.count || 0) + (draftDeal.count || 0), 
        dealersPending: draftDeal.count || 0,
        farmers: (farm.count || 0) + (draftFarm.count || 0), 
        farmersPending: draftFarm.count || 0,
      });
    })();
  }, []);

  if (authLoading || permLoading) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!dashboardAccess.can_view) {
    return (
      <AppLayout onLogout={onLogout}>
        <div className="flex flex-col items-center justify-center h-[60vh] text-center">
          <Shield className="h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold">Access Denied</h2>
          <p className="text-muted-foreground">You do not have permission to view the Dashboard Overview.</p>
        </div>
      </AppLayout>
    );
  }

  const totalPending = (c?.distributorsPending || 0) + (c?.dealersPending || 0) + (c?.farmersPending || 0);

  return (
    <AppLayout onLogout={onLogout}>
      <div className="space-y-8">
        <div>
          <h2 className="text-lg font-semibold mb-1">Overview</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Live command center across sales executives, distributors, dealers, and farmers.
          </p>
        </div>

        {/* 🚀 RESPONSIVE FIX: Adjusted grid columns and spacing so text has room to breathe */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          <KpiCard title="Sales Executives" value={c.ses} icon={UserCog} description="Active SEs in territory" to="/sales-executives" />
          <KpiCard title="SE Profiles Complete" value={c.sesComplete} icon={CheckCircle2} description="Finished mobile onboarding" />
          <KpiCard title="Distributors" value={c.distributors} icon={Truck} description="View directory" to="/distributors" />
          <KpiCard title="Dealers" value={c.dealers} icon={Users} description="View directory" to="/dealers" />
          <KpiCard title="Farmers" value={c.farmers} icon={Wheat} description="View directory" to="/farmers" />
          <KpiCard title="Total Drafts" value={totalPending} icon={Clock} description="Drafts across all directories" accent="muted" />
        </div>

        {role === 'Super Admin' && (
          <div className="border-t pt-8">
            <AdminUserManagement />
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default Dashboard;