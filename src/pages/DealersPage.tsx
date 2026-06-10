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
      const formattedDrafts = ((draftsData as any[]) || []).map((draft: any) => {
        const d = draft.draft_data || {};
        return {
          id: draft.entity_id,
          se_id: draft.se_id,
          primary_shop_name: d.shopName || 'Incomplete Dealer',
          contact_person: d.owners?.[0]?.name || '—',
          contact_mobile: d.contactMobile || '—',
          primary_address: d.address || '—',
          category: '—',
          status: 'DRAFT', 
          total_score: 0,
          created_at: draft.updated_at,
          profiles: draft.profiles,
          // === NEW MAP: Pass all draft data to the Edit Sheet ===
          gst_number: d.gstNumber,
          pan_number: d.panNumber,
          est_year: d.estYear,
          firm_type: d.firmType,
          primary_shop_location: {
            state: d.state, city: d.city, taluka: d.taluka, village: d.village, landmark: d.landmark, landlineNumber: d.landlineNumber
          },
          owners_list: d.owners,
          bank_details: { bankAccounts: d.bankAccounts },
          additional_locations: { additionalShops: d.additionalShops, godowns: d.godowns },
          distributor_links: d.linkedDistributors,
          demo_farmers_data: d.demoFarmers,
          commitments: {
            proposedStatus: d.proposedStatus, willingDemoFarmers: d.willingDemoFarmers,
            hasAdditionalLocations: d.hasAdditionalLocations, isLinkedToDistributor: d.isLinkedToDistributor,
            glsCommitments: d.glsCommitments, complianceChecklist: d.complianceChecklist
          },
          documents: d.documents,
          scoring: {
            scoreFinancial: d.scoreFinancial, remFinancial: d.remFinancial,
            scoreReputation: d.scoreReputation, remReputation: d.remReputation,
            scoreOperations: d.scoreOperations, remOperations: d.remOperations,
            scoreFarmerNetwork: d.scoreFarmerNetwork, remFarmerNetwork: d.remFarmerNetwork,
            scoreTeam: d.scoreTeam, remTeam: d.remTeam,
            scorePortfolio: d.scorePortfolio, remPortfolio: d.remPortfolio,
            scoreExperience: d.scoreExperience, remExperience: d.remExperience,
            scoreGrowth: d.scoreGrowth, remGrowth: d.remGrowth, redFlags: d.redFlags
          },
          annexures: {
            seTerritories: d.seTerritories, sePrincipalSuppliers: d.sePrincipalSuppliers,
            seChemicalProducts: d.seChemicalProducts, seBioProducts: d.seBioProducts,
            seOtherProducts: d.seOtherProducts, seHasCreditReferences: d.seHasCreditReferences,
            seCreditReferences: d.seCreditReferences, seWillShareSales: d.seWillShareSales,
            seGrowthVision: d.seGrowthVision, seSecurityDeposit: d.seSecurityDeposit,
            sePaymentProofText: d.sePaymentProofText
          }
        };
      });

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
      <DealerDetailSheet 
  dealer={selected} 
  open={!!selected} 
  onClose={() => setSelected(null)} 
  onSaved={() => window.location.reload()} 
/>
    </AppLayout>
  );
};

export default DealersPage;