import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { KeyValueGrid, Section, renderValue } from '@/lib/jsonViewer';
import type { SERow } from './SETable';

interface Props { se: SERow | null; open: boolean; onClose: () => void; }

const SEDetailSheet = ({ se, open, onClose }: Props) => {
  if (!se) return null;
  const sx = se.sales_executive || {};
  const insurances = (sx.financial_details as any)?.insurances;

  return (
    <Sheet open={open} onOpenChange={o => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-2xl lg:max-w-3xl p-0">
        <div className="flex flex-col h-full">
          <SheetHeader className="px-6 py-5 border-b border-border space-y-2">
            <div className="flex items-center justify-between gap-4">
              <SheetTitle className="text-xl">{se?.name || 'Sales Executive'}</SheetTitle>
              <Badge variant={sx?.is_profile_complete ? 'default' : 'secondary'}>
                {sx?.is_profile_complete ? 'Profile Complete' : 'Profile Pending'}
              </Badge>
            </div>
            <SheetDescription className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
              <span>📱 {se?.mobile || 'N/A'}</span>
              <span>✉️ {se?.email || 'N/A'}</span>
            </SheetDescription>
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
