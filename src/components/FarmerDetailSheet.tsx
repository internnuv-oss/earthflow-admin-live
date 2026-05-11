import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileText } from 'lucide-react';
import { KeyValueGrid, Section, fmtKey } from '@/lib/jsonViewer';
import type { FarmerRow } from './FarmerTable';

interface Props { farmer: FarmerRow | null; open: boolean; onClose: () => void; }

const FarmerDetailSheet = ({ farmer: f, open, onClose }: Props) => {
  if (!f) return null;
  const farm = f?.farm_details || {};
  const farmRest: Record<string, unknown> = {};
  const arrayFields: Array<[string, any[]]> = [];
  for (const [k, v] of Object.entries(farm)) {
    if (Array.isArray(v) && v.every(x => typeof x === 'string' || typeof x === 'number')) {
      arrayFields.push([k, v]);
    } else {
      farmRest[k] = v;
    }
  }
  const pastCrops: any[] = (f?.history_details as any)?.pastCrops || [];
  const pastCropKeys = pastCrops.length > 0 && typeof pastCrops[0] === 'object'
    ? Array.from(new Set(pastCrops.flatMap(c => Object.keys(c || {}))))
    : [];

  return (
    <Sheet open={open} onOpenChange={o => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-2xl lg:max-w-3xl p-0">
        <div className="flex flex-col h-full">
          <SheetHeader className="px-6 py-5 border-b border-border space-y-2">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <SheetTitle className="text-xl truncate">{f?.full_name || 'Farmer'}</SheetTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  {f?.village || 'No village'} · Onboarded by {f?.profiles?.name || 'N/A'}
                </p>
              </div>
              <Badge>{f?.status || 'DRAFT'}</Badge>
            </div>
            {f?.pdf_url && (
              <Button asChild size="sm" variant="outline" className="self-start gap-2">
                <a href={f.pdf_url} target="_blank" rel="noreferrer"><FileText className="h-4 w-4" /> View PDF Dossier</a>
              </Button>
            )}
          </SheetHeader>

          <Tabs defaultValue="personal" className="flex-1 flex flex-col min-h-0">
            <TabsList className="mx-6 mt-4 grid grid-cols-3 w-auto">
              <TabsTrigger value="personal">Personal</TabsTrigger>
              <TabsTrigger value="farm">Farm Details</TabsTrigger>
              <TabsTrigger value="history">Cultivation History</TabsTrigger>
            </TabsList>
            <ScrollArea className="flex-1 mt-3">
              <div className="px-6 pb-8">
                <TabsContent value="personal" className="space-y-4 mt-0">
                  <Section title="Personal Details">
                    <KeyValueGrid data={{ 'Mobile': f?.mobile, ...(f?.personal_details || {}) }} />
                  </Section>
                </TabsContent>
                <TabsContent value="farm" className="space-y-4 mt-0">
                  <Section title="Farm Information"><KeyValueGrid data={farmRest} /></Section>
                  {arrayFields.map(([k, vals]) => (
                    <Section key={k} title={fmtKey(k)}>
                      <div className="flex flex-wrap gap-1.5">
                        {vals.map((v, i) => <Badge key={i} variant="secondary">{String(v)}</Badge>)}
                      </div>
                    </Section>
                  ))}
                </TabsContent>
                <TabsContent value="history" className="space-y-4 mt-0">
                  <Section title="Past Crops">
                    {pastCrops.length === 0 ? (
                      <p className="text-sm text-muted-foreground italic">No history recorded</p>
                    ) : pastCropKeys.length > 0 ? (
                      <div className="rounded-md border border-border overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/50">
                              {pastCropKeys.map(k => <TableHead key={k} className="font-semibold whitespace-nowrap">{fmtKey(k)}</TableHead>)}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {pastCrops.map((row, i) => (
                              <TableRow key={i}>
                                {pastCropKeys.map(k => (
                                  <TableCell key={k} className="text-sm">{row?.[k] != null ? String(row[k]) : '—'}</TableCell>
                                ))}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {pastCrops.map((c, i) => <Badge key={i} variant="secondary">{String(c)}</Badge>)}
                      </div>
                    )}
                  </Section>
                  {(f?.history_details && Object.keys(f.history_details).filter(k => k !== 'pastCrops').length > 0) && (
                    <Section title="Other History">
                      <KeyValueGrid data={Object.fromEntries(Object.entries(f.history_details).filter(([k]) => k !== 'pastCrops'))} />
                    </Section>
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

export default FarmerDetailSheet;
