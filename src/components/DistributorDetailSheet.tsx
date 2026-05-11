import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileText } from 'lucide-react';
import { KeyValueGrid, Section } from '@/lib/jsonViewer';
import type { DistributorRow } from './DistributorTable';

interface Props { distributor: DistributorRow | null; open: boolean; onClose: () => void; }

const DistributorDetailSheet = ({ distributor: d, open, onClose }: Props) => {
  if (!d) return null;
  return (
    <Sheet open={open} onOpenChange={o => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-2xl lg:max-w-3xl p-0">
        <div className="flex flex-col h-full">
          <SheetHeader className="px-6 py-5 border-b border-border space-y-2">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <SheetTitle className="text-xl truncate">{d?.firm_name || 'Distributor'}</SheetTitle>
                <p className="text-xs text-muted-foreground mt-1">Onboarded by {d?.profiles?.name || 'N/A'}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <Badge>{d?.status || 'DRAFT'}</Badge>
                {d?.band && <Badge variant="secondary">{d.band} {d?.total_score != null ? `· ${d.total_score}` : ''}</Badge>}
              </div>
            </div>
            {d?.pdf_url && (
              <Button asChild size="sm" variant="outline" className="self-start gap-2">
                <a href={d.pdf_url} target="_blank" rel="noreferrer"><FileText className="h-4 w-4" /> View PDF Dossier</a>
              </Button>
            )}
          </SheetHeader>

          <Tabs defaultValue="basic" className="flex-1 flex flex-col min-h-0">
            <TabsList className="mx-6 mt-4 grid grid-cols-4 w-auto">
              <TabsTrigger value="basic">Basic Info</TabsTrigger>
              <TabsTrigger value="profiling">Profiling</TabsTrigger>
              <TabsTrigger value="network">Network &amp; Bank</TabsTrigger>
              <TabsTrigger value="annexures">Annexures</TabsTrigger>
            </TabsList>
            <ScrollArea className="flex-1 mt-3">
              <div className="px-6 pb-8">
                <TabsContent value="basic" className="space-y-4 mt-0">
                  <Section title="Firm Details">
                    <KeyValueGrid data={{
                      'Owner': d?.owner_name, 'Contact Person': d?.contact_person,
                      'Mobile': d?.contact_mobile, 'Email': d?.email,
                      'Firm Type': d?.firm_type, 'Established': d?.est_year,
                    }} />
                  </Section>
                  <Section title="Address">
                    <KeyValueGrid data={{
                      'Address': d?.address, 'City': d?.city, 'Taluka': d?.taluka,
                      'State': d?.state, 'Pincode': d?.pincode,
                    }} />
                  </Section>
                  <Section title="Statutory">
                    <KeyValueGrid data={{ 'GST Number': d?.gst_number, 'PAN Number': d?.pan_number }} />
                  </Section>
                </TabsContent>
                <TabsContent value="profiling" className="space-y-4 mt-0">
                  <Section title="Scoring"><KeyValueGrid data={d?.scoring} /></Section>
                  <Section title="Business Scope"><KeyValueGrid data={d?.business_scope} /></Section>
                  <Section title="Commitments"><KeyValueGrid data={d?.commitments} /></Section>
                </TabsContent>
                <TabsContent value="network" className="space-y-4 mt-0">
                  <Section title="Dealer Network"><KeyValueGrid data={d?.dealer_network} /></Section>
                  <Section title="Bank Details"><KeyValueGrid data={d?.bank_details} /></Section>
                  <Section title="Documents"><KeyValueGrid data={d?.documents} /></Section>
                </TabsContent>
                <TabsContent value="annexures" className="space-y-4 mt-0">
                  <Section title="Annexures"><KeyValueGrid data={d?.annexures} /></Section>
                  {d?.raw_data && Object.keys(d.raw_data || {}).length > 0 && (
                    <Section title="Raw Submission Data"><KeyValueGrid data={d?.raw_data} /></Section>
                  )}
                </TabsContent>
              </div>
            </ScrollArea>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default DistributorDetailSheet;
