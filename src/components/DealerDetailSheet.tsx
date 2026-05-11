import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileText } from 'lucide-react';
import { KeyValueGrid, Section, renderValue } from '@/lib/jsonViewer';
import type { DealerRow } from './DealerTable';

interface Props { dealer: DealerRow | null; open: boolean; onClose: () => void; }

const DealerDetailSheet = ({ dealer: d, open, onClose }: Props) => {
  if (!d) return null;
  return (
    <Sheet open={open} onOpenChange={o => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-2xl lg:max-w-3xl p-0">
        <div className="flex flex-col h-full">
          <SheetHeader className="px-6 py-5 border-b border-border space-y-2">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <SheetTitle className="text-xl truncate">{d?.primary_shop_name || 'Dealer'}</SheetTitle>
                <p className="text-xs text-muted-foreground mt-1">Onboarded by {d?.profiles?.name || 'N/A'}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <Badge>{d?.status || 'DRAFT'}</Badge>
                {d?.category && <Badge variant="secondary">{d.category}</Badge>}
              </div>
            </div>
            {d?.pdf_url && (
              <Button asChild size="sm" variant="outline" className="self-start gap-2">
                <a href={d.pdf_url} target="_blank" rel="noreferrer"><FileText className="h-4 w-4" /> View PDF Dossier</a>
              </Button>
            )}
          </SheetHeader>

          <Tabs defaultValue="business" className="flex-1 flex flex-col min-h-0">
            <TabsList className="mx-6 mt-4 grid grid-cols-4 w-auto">
              <TabsTrigger value="business">Business</TabsTrigger>
              <TabsTrigger value="bank">Bank &amp; Score</TabsTrigger>
              <TabsTrigger value="commitments">Commitments</TabsTrigger>
              <TabsTrigger value="extras">Annexures</TabsTrigger>
            </TabsList>
            <ScrollArea className="flex-1 mt-3">
              <div className="px-6 pb-8">
                <TabsContent value="business" className="space-y-4 mt-0">
                  <Section title="Shop Details">
                    <KeyValueGrid data={{
                      'Contact Person': d?.contact_person, 'Mobile': d?.contact_mobile,
                      'Address': d?.primary_address, 'GST': d?.gst_number, 'PAN': d?.pan_number,
                      'Firm Type': d?.firm_type, 'Established': d?.est_year,
                    }} />
                  </Section>
                  <Section title="Owners">{renderValue(d?.owners_list)}</Section>
                  <Section title="Primary Shop Location"><KeyValueGrid data={d?.primary_shop_location} /></Section>
                  <Section title="Additional Locations">{renderValue(d?.additional_locations)}</Section>
                  <Section title="Distributor Links">{renderValue(d?.distributor_links)}</Section>
                </TabsContent>
                <TabsContent value="bank" className="space-y-4 mt-0">
                  <Section title="Bank Details"><KeyValueGrid data={d?.bank_details} /></Section>
                  <Section title="Scoring"><KeyValueGrid data={d?.scoring} /></Section>
                  {d?.total_score != null && (
                    <p className="text-sm text-muted-foreground">Total Score: <span className="font-semibold text-foreground">{d.total_score}</span></p>
                  )}
                  <Section title="Documents"><KeyValueGrid data={d?.documents} /></Section>
                </TabsContent>
                <TabsContent value="commitments" className="space-y-4 mt-0">
                  <Section title="Commitments"><KeyValueGrid data={d?.commitments} /></Section>
                </TabsContent>
                <TabsContent value="extras" className="space-y-4 mt-0">
                  <Section title="Annexures"><KeyValueGrid data={d?.annexures} /></Section>
                  <Section title="Demo Farmers">{renderValue(d?.demo_farmers_data)}</Section>
                </TabsContent>
              </div>
            </ScrollArea>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default DealerDetailSheet;
