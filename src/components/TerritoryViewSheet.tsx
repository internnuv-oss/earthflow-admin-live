import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { 
  ChevronLeft, ChevronRight, Map as MapIcon, MapPin, Users, UserCircle, 
  Loader2, AlertCircle, TrendingUp, LayoutDashboard, Download
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import FarmerDetailSheet from './FarmerDetailSheet';
import { cn } from '@/lib/utils';

// 🚀 IMPORT THE VISUAL PROGRESS BAR FROM YOUR TABLE FILE
import { StageProgressBar, getFarmerStage } from './FarmerTable';

interface Props {
  se: any | null;
  open: boolean;
  onClose: () => void;
}

type ViewLevel = 'routes' | 'villages' | 'farmers';

// 🚀 DYNAMIC ANALYTICS TABLE COMPONENT
const AnalyticsTable = ({ entities }: { entities: { name: string, farmers: any[], villageCount: number }[] }) => {
  
  const computeMetrics = (farmers: any[], villageCount: number) => {
    if (!farmers || farmers.length === 0) {
      return {
        villageCount, totalFarmers: 0, completed: 0, drafts: 0, fsppCount: 0, avgScore: 0,
        totalLand: '0', committedLand: '0', avgLand: '0', topCrops: '—', topSoils: '—',
        primaryStage: '—', lastVisited: '—'
      };
    }

    const totalFarmers = farmers.length;
    const completed = farmers.filter(f => !f.is_draft).length;
    const drafts = farmers.filter(f => f.is_draft).length;
    const fspp = farmers.filter(f => f.fspp_details && Object.keys(f.fspp_details).length > 0);
    
    const avgScore = fspp.length > 0 
      ? Math.round(fspp.reduce((sum, f) => sum + Number(f.fspp_details?.score || 0), 0) / fspp.length) 
      : 0;

    const farmersWithLand = farmers.filter(f => Number(f.farm_details?.totalLand || 0) > 0);
    const totalLand = farmersWithLand.reduce((sum, f) => sum + Number(f.farm_details?.totalLand || 0), 0);
    const committedLand = fspp.reduce((sum, f) => sum + Number(f.fspp_details?.committedLand || 0), 0);
    const avgLand = farmersWithLand.length > 0 ? (totalLand / farmersWithLand.length).toFixed(1) : '0';

    const cropMap = new Map();
    let cropTotal = 0;
    
    const soilMap = new Map();
    let soilTotal = 0;
    
    farmers.forEach(f => {
      (f.farm_details?.majorCrops || []).forEach((c: string) => {
        cropMap.set(c, (cropMap.get(c) || 0) + 1);
        cropTotal++;
      });
      (f.farm_details?.soilType || []).forEach((s: string) => {
        soilMap.set(s, (soilMap.get(s) || 0) + 1);
        soilTotal++;
      });
    });
    
    const topCrops = cropTotal > 0
      ? Array.from(cropMap.entries())
          .sort((a, b) => b[1] - a[1])
          .map(e => `${e[0]} (${Math.round((e[1]/cropTotal)*100)}%)`)
          .join(', ')
      : '—';

    const topSoils = soilTotal > 0 
      ? Array.from(soilMap.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 2)
          .map(e => `${e[0]} (${Math.round((e[1]/soilTotal)*100)}%)`)
          .join(', ') 
      : '—';

    const dates = farmers.map(f => new Date(f.updated_at || f.created_at).getTime()).filter(t => !isNaN(t));
    const lastVisited = dates.length > 0 ? new Date(Math.max(...dates)).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

    const bioMap = new Map();
    let bioTotal = 0;
    
    farmers.forEach(f => {
      const stage = f.farm_details?.biofertilizer || f.fspp_details?.statusLabel || 'Unknown';
      bioMap.set(stage, (bioMap.get(stage) || 0) + 1);
      bioTotal++;
    });
    
    const primaryStage = bioTotal > 0
      ? Array.from(bioMap.entries())
          .sort((a, b) => b[1] - a[1])
          .map(e => `${e[0]} (${Math.round((e[1]/bioTotal)*100)}%)`)
          .join(', ')
      : '—';

    return {
      villageCount, totalFarmers, completed, drafts, fsppCount: fspp.length, avgScore,
      totalLand: totalLand.toFixed(1), committedLand: committedLand.toFixed(1), avgLand,
      topCrops, topSoils, primaryStage, lastVisited
    };
  };

  const columnData = entities.map(e => computeMetrics(e.farmers, e.villageCount));

  const rows = [
    { label: "Number of Villages", key: "villageCount" },
    { label: "Number of Farmers", key: "totalFarmers" },
    { label: "Completed Profile Farmer", key: "completed" },
    { label: "Draft Farmer", key: "drafts" },
    { label: "FSPP Enrolled Farmer", key: "fsppCount" },
    { label: "Average Score", key: "avgScore" },
    { label: "Total Land (Acres)", key: "totalLand" },
    { label: "Committed Land for Bio", key: "committedLand" },
    { label: "Average Land/Farmer (Acres)", key: "avgLand" },
    { label: "Major Crops", key: "topCrops" },
    { label: "Soil Type & %", key: "topSoils" },
    { label: "Biofertilizer Stage", key: "primaryStage" },
    { label: "Last Visited on", key: "lastVisited" }
  ];

  const exportToPDF = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const headersHtml = `<th>Metrics</th>` + entities.map(e => `<th>${e.name}</th>`).join('');

    const rowsHtml = rows.map((row) => {
      const rowDataHtml = columnData.map(data => `<td>${data[row.key as keyof typeof data]}</td>`).join('');
      return `<tr>
          <td><strong>${row.label}</strong></td>
          ${rowDataHtml}
      </tr>`;
    }).join('');
    
    printWindow.document.write(`
      <html>
        <head>
          <title>Territory Analytics Export</title>
          <style>
            body { font-family: sans-serif; padding: 20px; }
            h2 { text-align: center; color: #333; margin-bottom: 5px; }
            p { text-align: center; color: #666; font-size: 12px; margin-top: 0; }
            table { border-collapse: collapse; width: 100%; font-size: 11px; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: center; }
            th { background-color: #f4f4f5; color: #333; }
            td:first-child { text-align: left; background-color: #fafafa; white-space: nowrap; }
            @media print {
              @page { size: landscape; margin: 10mm; }
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            }
          </style>
        </head>
        <body>
          <h2>Territory Analytics Report</h2>
          <p>Export Date: ${new Date().toLocaleDateString()}</p>
          <table>
            <thead>
              <tr>${headersHtml}</tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
          <script>
            setTimeout(() => { window.print(); window.close(); }, 500);
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  if (entities.length === 0) {
    return <div className="text-sm italic text-muted-foreground p-4 text-center">No data available to display.</div>;
  }

  return (
    <div className="space-y-3 animate-in fade-in duration-500">
      <div className="flex justify-end">
        <Button 
          onClick={exportToPDF} 
          size="sm" 
          variant="outline" 
          className="bg-primary/5 text-primary border-primary/20 hover:bg-primary/10 gap-2"
        >
          <Download className="h-4 w-4" /> Download PDF
        </Button>
      </div>

      <div className="grid grid-cols-1 max-w-full w-full bg-white border rounded-lg shadow-sm overflow-hidden">
        <div className="w-full overflow-x-auto overflow-y-auto max-h-[65vh] custom-scrollbar"> 
          <table className="w-full text-sm text-left border-collapse">
            <thead className="bg-muted border-b sticky top-0 z-20">
              <tr>
                <th className="px-4 py-3 font-semibold text-muted-foreground whitespace-nowrap sticky left-0 top-0 bg-muted z-30 border-r border-b shadow-[2px_2px_5px_-2px_rgba(0,0,0,0.1)] outline outline-1 outline-border">
                  Metrics
                </th>
                {entities.map((e, i) => (
                  <th key={i} className="px-4 py-3 font-bold text-foreground whitespace-nowrap min-w-[180px] text-center border-r border-b last:border-r-0 sticky top-0 bg-muted z-20 outline outline-1 outline-border">
                    {e.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((row, i) => (
                <tr key={i} className="hover:bg-muted/10 transition-colors">
                  <td className="px-4 py-3 font-medium text-muted-foreground whitespace-nowrap sticky left-0 bg-white z-10 border-r shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] outline outline-1 outline-border">
                    {row.label}
                  </td>
                  {columnData.map((data, colIdx) => (
                    <td key={colIdx} className={`px-4 py-3 text-center border-r last:border-r-0 font-medium text-foreground/90 
                      ${['topCrops', 'topSoils', 'primaryStage'].includes(row.key) ? 'text-xs min-w-[220px] max-w-[300px] break-words whitespace-normal' : 'whitespace-nowrap'}`}
                    >
                      {data[row.key as keyof typeof data]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export const TerritoryViewSheet = ({ se, open, onClose }: Props) => {
  const [level, setLevel] = useState<ViewLevel>('routes');
  const [activeRoute, setActiveRoute] = useState<any | null>(null);
  const [activeVillage, setActiveVillage] = useState<string | null>(null);
  const [displayRoutes, setDisplayRoutes] = useState<any[]>([]);
  const [farmers, setFarmers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedFarmer, setSelectedFarmer] = useState<any | null>(null);

  useEffect(() => {
    if (open && se) {
      setLevel('routes');
      setActiveRoute(null);
      setActiveVillage(null);
      fetchAllFarmersInTerritory();
    }
  }, [open, se]);

  const fetchAllFarmersInTerritory = async () => {
    if (!se) return;
    setLoading(true);

    const officialVillages = new Set<string>();
    (se.routes || []).forEach((route: any) => {
      route.locations?.forEach((loc: any) => {
        loc.villages?.forEach((v: string) => officialVillages.add(v.trim().toLowerCase()));
      });
    });

    // 🚀 NEW: Add the Farm Cards fetch to establish absolute ground truth for the progress bar
    const [farmersRes, draftsRes, farmCardsRes] = await Promise.all([
      supabase.from('farmers').select('*, profiles:se_id(name)').eq('se_id', se.id).eq('status', 'SUBMITTED'),
      supabase.from('drafts').select('*, profiles:se_id(name)').eq('se_id', se.id).eq('entity_type', 'farmer'),
      (supabase as any).from('farm_cards').select('farmer_id').eq('se_id', se.id)
    ]);

    // Fast lookup Set of all farmers who have at least one farm card
    const farmersWithCards = new Set((farmCardsRes.data || []).map((fc: any) => fc.farmer_id));

    // Map through submitted farmers and attach Ground Truth card status
    const submittedFarmers = (farmersRes.data || []).map(f => ({
      ...f,
      has_farm_card: farmersWithCards.has(f.id)
    }));

    // Map through drafts and attach Ground Truth card status
    const draftFarmers = (draftsRes.data || []).map(draft => {
        const data = draft.draft_data as any; 
        const id = draft.entity_id || draft.id;
        return {
          id,
          status: 'DRAFT',
          is_draft: true,
          full_name: data?.fullName || data?.full_name || 'Unnamed Draft', 
          mobile: data?.mobile || 'No Mobile',
          village: data?.village || '',
          created_at: draft.created_at,
          updated_at: draft.updated_at,
          fspp_details: data?.fspp_details || {},
          has_farm_card: farmersWithCards.has(id), // 🚀 Ground Truth attached!
          personal_details: { village: data?.village || '' },
          farm_details: {
            totalLand: data?.totalLand || 0,
            majorCrops: data?.majorCrops || [],
            soilType: data?.soilType || [],
            biofertilizer: data?.biofertilizer || ''
          },
          profiles: draft.profiles
        };
      });

    const combinedData = [...submittedFarmers, ...draftFarmers];
    setFarmers(combinedData);

    const orphanVillagesMap = new Map();
    combinedData.forEach(f => {
      const v = (f.village || (f.personal_details as any)?.village || '').trim();
      if (v && !officialVillages.has(v.toLowerCase())) {
        orphanVillagesMap.set(v.toLowerCase(), v);
      }
    });

    if (orphanVillagesMap.size > 0) {
      const othersRoute = {
        id: 'others-custom-route',
        name: 'Others (Out of Route)',
        is_custom_others: true,
        locations: [{ villages: Array.from(orphanVillagesMap.values()) }]
      };
      setDisplayRoutes([...(se.routes || []), othersRoute]);
    } else {
      setDisplayRoutes(se.routes || []);
    }

    setLoading(false);
  };

  const getVillageCountForRoute = (route: any) => {
    if (route.is_custom_others) return route.locations[0].villages.length;
    let count = 0;
    route.locations?.forEach((loc: any) => { count += (loc.villages?.length || 0); });
    return count;
  };

  const getFarmersForVillage = (villageName: string) => {
    const vSafe = villageName.trim().toLowerCase();
    return farmers.filter(f => (f.village || (f.personal_details as any)?.village || '').trim().toLowerCase() === vSafe);
  };

  const getFarmersForRoute = (route: any) => {
    let routeFarmers: any[] = [];
    if (route.is_custom_others) {
        route.locations[0].villages.forEach((v: string) => { routeFarmers = [...routeFarmers, ...getFarmersForVillage(v)]; });
    } else {
        route.locations?.forEach((loc: any) => {
          loc.villages?.forEach((v: string) => { routeFarmers = [...routeFarmers, ...getFarmersForVillage(v)]; });
        });
    }
    return routeFarmers;
  };

  if (!se) return null;

  return (
    <>
      <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent 
        side="right" 
        className="w-full sm:max-w-[92vw] flex flex-col p-0 border-l-0 shadow-2xl transition-all duration-300"
      >
          
          <SheetHeader className="px-6 py-4 border-b bg-muted/10">
            <div className="flex items-center gap-3">
              {level !== 'routes' && (
                <Button variant="outline" size="icon" className="h-8 w-8 shrink-0 rounded-full" onClick={() => {
                  if (level === 'farmers') setLevel('villages');
                  else if (level === 'villages') { setLevel('routes'); setActiveRoute(null); }
                }}>
                  <ChevronLeft className="h-5 w-5" />
                </Button>
              )}
              <div className="flex-1 min-w-0">
                <SheetTitle className="text-lg flex items-center gap-2 truncate">
                  {level === 'routes' && <><LayoutDashboard className="h-5 w-5 text-primary" /> {se.name}</>}
                  {level === 'villages' && <><MapIcon className="h-5 w-5 text-primary" /> {activeRoute?.name}</>}
                  {level === 'farmers' && <><MapPin className="h-5 w-5 text-primary" /> {activeVillage}</>}
                </SheetTitle>
              </div>
            </div>
          </SheetHeader>

          <ScrollArea className="flex-1 bg-muted/5">
            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary/40" /></div>
            ) : (
              <div className="px-6 py-4">
                
                {level === 'routes' && (
                  <Tabs defaultValue="list" className="w-full">
                    <TabsList className="w-full bg-muted/50 p-1 mb-4">
                      <TabsTrigger value="list" className="flex-1 gap-2"><MapIcon className="h-4 w-4" /> Route List</TabsTrigger>
                      <TabsTrigger value="analytics" className="flex-1 gap-2"><TrendingUp className="h-4 w-4" /> Analytics Table</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="list" className="space-y-3 outline-none">
                      {displayRoutes.map((route: any) => {
                        const count = getVillageCountForRoute(route);
                        const fCount = getFarmersForRoute(route).length;
                        return (
                          <div key={route.id} onClick={() => { setActiveRoute(route); setLevel('villages'); }}
                            className={`flex items-center justify-between p-4 bg-white border rounded-xl shadow-sm cursor-pointer hover:border-primary transition-all active:scale-[0.98] ${route.is_custom_others ? 'border-amber-200 bg-amber-50/20' : ''}`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${route.is_custom_others ? 'bg-amber-100' : 'bg-primary/10'}`}>
                                {route.is_custom_others ? <AlertCircle className="h-5 w-5 text-amber-600" /> : <MapIcon className="h-5 w-5 text-primary" />}
                              </div>
                              <div>
                                <h4 className="font-bold text-sm">{route.name}</h4>
                                <p className="text-[11px] text-muted-foreground flex items-center gap-2">
                                    <span>{count} Villages</span>
                                </p>
                              </div>
                            </div>
                            <Badge variant="outline" className="font-bold bg-muted/50">{fCount} Farmers</Badge>
                          </div>
                        );
                      })}
                    </TabsContent>
                    
                    <TabsContent value="analytics" className="outline-none">
                      <AnalyticsTable 
                        entities={displayRoutes.map(route => ({
                          name: route.name,
                          farmers: getFarmersForRoute(route),
                          villageCount: getVillageCountForRoute(route)
                        }))} 
                      />
                    </TabsContent>
                  </Tabs>
                )}

                {level === 'villages' && activeRoute && (
                  <Tabs defaultValue="list" className="w-full">
                    <TabsList className="w-full bg-muted/50 p-1 mb-4">
                      <TabsTrigger value="list" className="flex-1 gap-2"><MapPin className="h-4 w-4" /> Village List</TabsTrigger>
                      <TabsTrigger value="analytics" className="flex-1 gap-2"><TrendingUp className="h-4 w-4" /> Analytics Table</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="analytics" className="outline-none">
                      <AnalyticsTable 
                        entities={(activeRoute.locations?.flatMap((loc: any) => loc.villages || []) || []).map((v: string) => ({
                          name: v,
                          farmers: getFarmersForVillage(v),
                          villageCount: 1
                        }))} 
                      />
                    </TabsContent>

                    <TabsContent value="list" className="space-y-3 outline-none">
                      {activeRoute.locations?.flatMap((loc: any) => loc.villages || []).map((v: string, i: number) => {
                        const fCount = getFarmersForVillage(v).length;
                        return (
                          <div key={i} onClick={() => { setActiveVillage(v); setLevel('farmers'); }}
                            className="flex items-center justify-between p-4 bg-white border rounded-xl shadow-sm cursor-pointer hover:border-primary transition-all"
                          >
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 bg-amber-100 rounded-lg flex items-center justify-center text-amber-700 font-bold text-xs">{v.charAt(0)}</div>
                              <h4 className="font-bold text-sm">{v}</h4>
                            </div>
                            <Badge variant="secondary" className="font-bold">{fCount} Farmers</Badge>
                          </div>
                        );
                      })}
                    </TabsContent>
                  </Tabs>
                )}

                {/* 🚀 LEVEL 3: FARMERS LIST WITH GROUND-TRUTH PROGRESS BAR */}
                {level === 'farmers' && activeVillage && (
                  <Tabs defaultValue="list" className="w-full">
                    <TabsList className="w-full bg-muted/50 p-1 mb-4">
                      <TabsTrigger value="list" className="flex-1 gap-2"><Users className="h-4 w-4" /> Farmer List</TabsTrigger>
                      <TabsTrigger value="analytics" className="flex-1 gap-2"><TrendingUp className="h-4 w-4" /> Analytics Table</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="analytics" className="outline-none">
                      <AnalyticsTable 
                        entities={[{
                          name: activeVillage,
                          farmers: getFarmersForVillage(activeVillage),
                          villageCount: 1
                        }]} 
                      />
                    </TabsContent>

                    <TabsContent value="list" className="space-y-3 outline-none">
                      {getFarmersForVillage(activeVillage).map((farmer: any) => (
                        <div 
                          key={farmer.id} 
                          onClick={() => setSelectedFarmer(farmer)}
                          className={cn(
                            "flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-white border rounded-xl shadow-sm cursor-pointer hover:border-primary/50 transition-all gap-6 sm:gap-4",
                            farmer.is_draft ? 'border-amber-200 bg-amber-50/10' : ''
                          )}
                        >
                          <div className="flex items-center gap-3 sm:w-1/3 shrink-0">
                            <UserCircle className={cn("h-10 w-10", farmer.is_draft ? 'text-amber-400' : 'text-primary/20')} />
                            <div>
                                <h4 className="font-bold text-sm flex items-center gap-2">
                                  {farmer.full_name} 
                                  {farmer.is_draft && <Badge variant="outline" className="text-[8px] h-4 bg-amber-100 border-amber-300 px-1 py-0">DRAFT</Badge>}
                                </h4>
                                <p className="text-xs text-muted-foreground">{farmer.mobile}</p>
                            </div>
                          </div>
                          
                          <div className="flex-1 flex justify-center overflow-visible py-2 sm:py-0 shrink-0">
                            <StageProgressBar stage={getFarmerStage(farmer)} />
                          </div>

                          <div className="hidden sm:flex justify-end shrink-0 w-8">
                            <ChevronRight className="h-5 w-5 text-muted-foreground" />
                          </div>
                        </div>
                      ))}
                    </TabsContent>
                  </Tabs>
                )}

              </div>
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>

      <FarmerDetailSheet farmer={selectedFarmer} open={!!selectedFarmer} onClose={() => setSelectedFarmer(null)} canEdit={false} />
    </>
  );
};