import { useEffect, useState } from 'react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { KeyValueGrid, Section, renderValue } from '@/lib/jsonViewer';
import type { SERow } from './SETable';
import { supabase } from '@/integrations/supabase/client';
import { Store, Tractor, Building2 } from 'lucide-react';

interface Props { se: SERow | null; open: boolean; onClose: () => void; }

const SEDetailSheet = ({ se, open, onClose }: Props) => {
  // 🚀 Added state to hold the live counts
  const [counts, setCounts] = useState({ dealers: 0, farmers: 0, distributors: 0 });

  // 🚀 Fetch the counts from Supabase every time the sheet opens
  // 🚀 Fetch the counts from Supabase every time the sheet opens
  useEffect(() => {
    if (!se?.id || !open) return;
    
    const fetchCounts = async () => {
      const [dealers, farmers, distributors] = await Promise.all([
        // Changed 'created_by' to 'se_id' to match your database schema
        supabase.from('dealers').select('id', { count: 'exact', head: true }).eq('se_id', se.id),
        supabase.from('farmers').select('id', { count: 'exact', head: true }).eq('se_id', se.id),
        supabase.from('distributors').select('id', { count: 'exact', head: true }).eq('se_id', se.id),
      ]);
      
      setCounts({
        dealers: dealers.count || 0,
        farmers: farmers.count || 0,
        distributors: distributors.count || 0,
      });
    };
    
    fetchCounts();
  }, [se?.id, open]);

  if (!se) return null;
  const sx = se.sales_executive || {};
  const insurances = (sx.financial_details as any)?.insurances;

  return (
    <Sheet open={open} onOpenChange={o => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-2xl lg:max-w-3xl p-0">
        <div className="flex flex-col h-full">
          <SheetHeader className="px-6 py-5 border-b border-border space-y-2 bg-slate-50/50">
            <div className="flex items-center justify-between gap-4">
              <SheetTitle className="text-xl">{se?.name || 'Sales Executive'}</SheetTitle>
              <Badge variant={sx?.is_profile_complete ? 'default' : 'secondary'}>
                {sx?.is_profile_complete ? 'Profile Complete' : 'Profile Incomplete'}
              </Badge>
            </div>
            <SheetDescription className="flex flex-wrap gap-x-4 gap-y-1 text-sm font-medium">
              <span>📱 {se?.mobile || 'N/A'}</span>
              <span>✉️ {se?.email || 'N/A'}</span>
            </SheetDescription>

            {/* 🚀 NEW: The KPI Network Bar */}
            <div className="flex gap-3 pt-3">
              <div className="flex flex-1 items-center justify-center gap-2 bg-blue-100/50 border border-blue-200 text-blue-800 px-3 py-2.5 rounded-lg shadow-sm">
                <Store className="h-5 w-5" />
                <div className="flex flex-col"><span className="text-xs opacity-80 leading-none">Dealers</span><span className="font-bold leading-none">{counts.dealers}</span></div>
              </div>
              <div className="flex flex-1 items-center justify-center gap-2 bg-green-100/50 border border-green-200 text-green-800 px-3 py-2.5 rounded-lg shadow-sm">
                <Tractor className="h-5 w-5" />
                <div className="flex flex-col"><span className="text-xs opacity-80 leading-none">Farmers</span><span className="font-bold leading-none">{counts.farmers}</span></div>
              </div>
              <div className="flex flex-1 items-center justify-center gap-2 bg-orange-100/50 border border-orange-200 text-orange-800 px-3 py-2.5 rounded-lg shadow-sm">
                <Building2 className="h-5 w-5" />
                <div className="flex flex-col"><span className="text-xs opacity-80 leading-none">Distributors</span><span className="font-bold leading-none">{counts.distributors}</span></div>
              </div>
            </div>
          </SheetHeader>

          <Tabs defaultValue="personal" className="flex-1 flex flex-col min-h-0">
            <TabsList className="mx-6 mt-4 grid grid-cols-4 w-auto">
              <TabsTrigger value="personal">Personal</TabsTrigger>
              <TabsTrigger value="organization">Organization</TabsTrigger>
              <TabsTrigger value="financial">Financial &amp; Assets</TabsTrigger>
              <TabsTrigger value="documents">Documents</TabsTrigger>
            </TabsList>
            <ScrollArea className="flex-1 mt-3">
              <div className="px-6 pb-8">
                <TabsContent value="personal" className="space-y-4 mt-0">
                  <Section title="Personal Details"><KeyValueGrid data={sx?.personal_details} /></Section>
                </TabsContent>
                <TabsContent value="organization" className="space-y-4 mt-0">
                  <Section title="Organization"><KeyValueGrid data={sx?.organization_details} /></Section>
                </TabsContent>
                <TabsContent value="financial" className="space-y-4 mt-0">
                  <Section title="Financial Details">
                    <KeyValueGrid data={(sx?.financial_details as any) ? Object.fromEntries(Object.entries(sx.financial_details).filter(([k]) => k !== 'insurances')) : null} />
                  </Section>
                  {insurances && (
                    <Section title="Insurances">{renderValue(insurances)}</Section>
                  )}
                  <Section title="Assets"><KeyValueGrid data={sx?.assets_details} /></Section>
                </TabsContent>
                <TabsContent value="documents" className="space-y-4 mt-0">
                  <Section title="Uploaded Documents"><KeyValueGrid data={sx?.documents} /></Section>
                </TabsContent>
              </div>
            </ScrollArea>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default SEDetailSheet;