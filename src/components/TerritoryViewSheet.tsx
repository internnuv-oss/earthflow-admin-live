import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { 
  ChevronLeft, ChevronRight, Map as MapIcon, MapPin, Users, UserCircle, 
  Loader2, AlertCircle, TrendingUp, LayoutDashboard, Download, Store
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import FarmerDetailSheet from './FarmerDetailSheet';
import { cn } from '@/lib/utils';
import { StageProgressBar, getFarmerStage } from './FarmerTable';
import { PolygonMap, MapPolygonFeature } from './PolygonMap';

interface Props {
  se: any | null;
  open: boolean;
  onClose: () => void;
}

type ViewLevel = 'routes' | 'villages' | 'farmers';

export const AnalyticsTable = ({ entities }: { entities: { name: string, farmers: any[], villageCount: number, externalFarmCardCount?: { total: number, drafts: number, completed: number }, externalFarmDiaryCount?: number }[] }) => {
  
  const computeMetrics = (farmers: any[], villageCount: number, externalFarmCardCount?: { total: number, drafts: number, completed: number }, externalFarmDiaryCount?: number) => {
    
    // 🚀 Format detailed Farm Card breakdown
    let farmCardDisplay = '0';
    if (externalFarmCardCount) {
      farmCardDisplay = `${externalFarmCardCount.total} (Draft: ${externalFarmCardCount.drafts}, Completed: ${externalFarmCardCount.completed})`;
    } else {
      // Fallback if calculating inside a specific route (TerritoryViewSheet)
      const inlineFarmCardCount = farmers?.filter(f => f.has_farm_card === true || (f.farm_cards && f.farm_cards.length > 0)).length || 0;
      farmCardDisplay = inlineFarmCardCount > 0 ? `${inlineFarmCardCount} (Draft: 0, Completed: ${inlineFarmCardCount})` : '0';
    }

    // 🚀 NEW: Format the Farm Diary metric
    let farmDiaryDisplay = '0';
    if (externalFarmDiaryCount !== undefined) {
      farmDiaryDisplay = externalFarmDiaryCount.toString();
    } else {
      // Fallback for Route Analytics: Count diaries directly attached to farmers in the route
      const inlineFarmDiaryCount = farmers?.filter(f => f.has_farm_diary === true || (f.farm_diary && f.farm_diary.length > 0)).length || 0;
      farmDiaryDisplay = inlineFarmDiaryCount.toString();
    }

    if (!farmers || farmers.length === 0) {
      return {
        villageCount, totalFarmers: 0, completed: 0, drafts: 0, 
        fsppCount: '0',
        farmCardCount: farmCardDisplay, 
        farmDiaryCount: farmDiaryDisplay, // 🚀 Added
        avgScore: 0, totalLand: '0', committedLand: '0', avgLand: '0', 
        topCrops: '—', topSoils: '—', primaryStage: '—', lastVisited: '—'
      };
    }

    const totalFarmers = farmers.length;
    const completed = farmers.filter(f => !f.is_draft).length;
    const drafts = farmers.filter(f => f.is_draft).length;
    
    const fspp = farmers.filter(f => f.fspp_details && Object.keys(f.fspp_details).length > 0);
    
    const farmCardCount = farmCardDisplay;
    const farmDiaryCount = farmDiaryDisplay; 

    const counts: Record<string, number> = {
      'Category A': 0, 'Category B': 0, 'Category C': 0, 'Category D': 0
    };
    
    fspp.forEach(f => {
      const cat = f.fspp_details?.category;
      if (counts[cat] !== undefined) counts[cat]++;
    });

    const activeCategories = Object.entries(counts)
      .filter(([_, count]) => count > 0)
      .map(([cat, count]) => `${cat}: ${count}`);

    const fsppCountDisplay = activeCategories.length > 0
      ? `${fspp.length} (${activeCategories.join(', ')})`
      : `${fspp.length}`;

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
    
    let topCrops = '—';
    if (cropTotal > 0) {
      let otherTotalCount = 0;
      const mainCropsList: string[] = [];

      const sortedCrops = Array.from(cropMap.entries()).sort((a, b) => b[1] - a[1]);

      sortedCrops.forEach(([cropName, count]) => {
        const percentage = Math.round((count / cropTotal) * 100);
        
        if (percentage <= 5) {
          otherTotalCount += count;
        } else {
          mainCropsList.push(`${cropName} (${percentage}%)`);
        }
      });

      if (otherTotalCount > 0) {
        const otherPercentage = Math.round((otherTotalCount / cropTotal) * 100);
        if (otherPercentage > 0) {
          mainCropsList.push(`Other (${otherPercentage}%)`);
        }
      }

      topCrops = mainCropsList.length > 0 ? mainCropsList.join(', ') : '—';
    }

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
      villageCount, totalFarmers, completed, drafts, 
      fsppCount: fsppCountDisplay,
      farmCardCount, 
      farmDiaryCount, 
      avgScore, totalLand: totalLand.toFixed(1), committedLand: committedLand.toFixed(1), avgLand,
      topCrops, topSoils, primaryStage, lastVisited
    };
  };

  const allFarmers = entities.flatMap(e => e.farmers || []);
  const totalVillageCount = entities.reduce((sum, e) => sum + (e.villageCount || 0), 0);
  
  const totalFarmCardsObj = entities.reduce((acc, e) => {
    if (e.externalFarmCardCount) {
      acc.total += e.externalFarmCardCount.total;
      acc.drafts += e.externalFarmCardCount.drafts;
      acc.completed += e.externalFarmCardCount.completed;
    } else {
      const inline = (e.farmers || []).filter(f => f.has_farm_card === true).length;
      acc.total += inline;
      acc.completed += inline;
    }
    return acc;
  }, { total: 0, drafts: 0, completed: 0 });

  const totalFarmDiaries = entities.reduce((sum, e) => {
    if (e.externalFarmDiaryCount !== undefined) return sum + e.externalFarmDiaryCount;
    return sum + ((e.farmers || []).filter(f => f.has_farm_diary === true || (f.farm_diary && f.farm_diary.length > 0)).length);
  }, 0);

  const renderEntities = [
    { 
      name: "TOTAL (ALL)", 
      farmers: allFarmers, 
      villageCount: totalVillageCount, 
      externalFarmCardCount: totalFarmCardsObj,
      externalFarmDiaryCount: totalFarmDiaries
    },
    ...entities
  ];

  const columnData = renderEntities.map(e => computeMetrics(e.farmers, e.villageCount, e.externalFarmCardCount, e.externalFarmDiaryCount));

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
    { label: "Farm Card Built", key: "farmCardCount" },  
    { label: "Farm Diary Built", key: "farmDiaryCount" },
    { label: "Major Crops", key: "topCrops" },
    { label: "Soil Type & %", key: "topSoils" },
    { label: "Biofertilizer Stage", key: "primaryStage" },
    { label: "Last Visited on", key: "lastVisited" }
  ];

  const exportToPDF = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const headersHtml = `<th>Metrics</th>` + renderEntities.map(e => `<th>${e.name}</th>`).join('');

    const rowsHtml = rows.map((row) => {
      const rowDataHtml = columnData.map((data, idx) => {
        const isTotalCol = idx === 0;
        return `<td style="${isTotalCol ? 'background-color: #f0fdf4; font-weight: bold;' : ''}">${data[row.key as keyof typeof data]}</td>`;
      }).join('');
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
          </style>
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
                {renderEntities.map((e, i) => {
                  const isTotalCol = i === 0;
                  return (
                    <th key={i} className={`px-4 py-3 font-bold whitespace-nowrap min-w-[180px] text-center border-r border-b last:border-r-0 sticky top-0 z-20 outline outline-1 outline-border
                      ${isTotalCol ? 'bg-primary/10 text-primary shadow-inner' : 'bg-muted text-foreground'}`}>
                      {e.name}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((row, i) => (
                <tr key={i} className="hover:bg-muted/10 transition-colors">
                  <td className="px-4 py-3 font-medium text-muted-foreground whitespace-nowrap sticky left-0 bg-white z-10 border-r shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] outline outline-1 outline-border">
                    {row.label}
                  </td>
                  {columnData.map((data, colIdx) => {
                    const isTotalCol = colIdx === 0;
                    return (
                      <td key={colIdx} className={`px-4 py-3 text-center border-r last:border-r-0 text-foreground/90 
                        ${['topCrops', 'topSoils', 'primaryStage', 'fsppCount'].includes(row.key) ? 'text-xs min-w-[220px] max-w-[300px] break-words whitespace-normal' : 'whitespace-nowrap'}
                        ${isTotalCol ? 'bg-primary/[0.03] font-bold text-primary border-primary/20' : 'font-medium'}`}
                      >
                        {data[row.key as keyof typeof data]}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};


const WebDealerCard = ({ dealer }: { dealer: any }) => {
  const dealerName = dealer.dealer_name || dealer['Dealer Name'] || dealer.Dealer_Name || 'Unknown Dealer';
  const village = dealer.village || dealer.Village || dealer.VILLAGE || '';
  const contactPerson = dealer.contact_person || dealer['Contact Person'] || dealer.Contact_Person || '';
  const mobile = dealer.mobile || dealer.Mobile || dealer.MOBILE || '';
  const address = dealer.address || dealer.Address || dealer.ADDRESS || '';
  const taluka = dealer.taluka || dealer.Taluka || dealer.TALUKA || '';
  const district = dealer.district || dealer.District || dealer.DISTRICT || '';

  return (
    <div className="flex flex-col p-4 bg-white border rounded-xl shadow-sm gap-2 hover:border-primary/50 transition-colors">
      <div className="flex items-start justify-between">
        <div>
          <h4 className="font-bold text-base text-foreground">{dealerName}</h4>
          <p className="text-sm font-semibold text-muted-foreground mt-1">Contact Person: <span className="text-foreground">{contactPerson || 'N/A'}</span></p>
          <p className="text-sm font-semibold text-muted-foreground">Mobile: <span className="text-foreground">{mobile || 'N/A'}</span></p>
        </div>
        <Badge className="bg-blue-50 text-blue-700 hover:bg-blue-50 border-blue-200">{village}</Badge>
      </div>
      <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
        <span className="font-bold text-foreground">Address:</span> {address ? `${address}, ` : ''}{taluka}, {district}
      </p>
    </div>
  );
};


export const TerritoryViewSheet = ({ se, open, onClose }: Props) => {
  const [level, setLevel] = useState<ViewLevel>('routes');
  const [activeRoute, setActiveRoute] = useState<any | null>(null);
  const [activeVillage, setActiveVillage] = useState<string | null>(null);
  const [displayRoutes, setDisplayRoutes] = useState<any[]>([]);
  const [farmers, setFarmers] = useState<any[]>([]);
  const [tempDealers, setTempDealers] = useState<any[]>([]); 
  const [loading, setLoading] = useState(false);
  const [selectedFarmer, setSelectedFarmer] = useState<any | null>(null);
  const [farmCards, setFarmCards] = useState<any[]>([]);
  const [farmDiaries, setFarmDiaries] = useState<any[]>([]);

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

    const pureRoutes = (se.routes || []).filter((r: any) => !r.is_custom_others);

    const officialVillages = new Set<string>();
    
    pureRoutes.forEach((route: any) => {
      if (route.locations && Array.isArray(route.locations)) {
        route.locations.forEach((loc: any) => {
          if (loc.villages && Array.isArray(loc.villages)) {
            loc.villages.forEach((v: string) => officialVillages.add(v.trim().toLowerCase()));
          }
          const locOther = loc.otherVillages || loc.other_villages || loc.other_route_villages;
          if (Array.isArray(locOther)) {
            locOther.forEach((v: string) => officialVillages.add(v.trim().toLowerCase()));
          } else if (typeof locOther === 'string') {
            locOther.split(',').forEach((v: string) => { if (v.trim()) officialVillages.add(v.trim().toLowerCase()); });
          }
        });
      }

      const routeOther = route.otherVillages || route.other_villages || route.other_route_villages || route.other_route;
      if (Array.isArray(routeOther)) {
        routeOther.forEach((v: string) => officialVillages.add(v.trim().toLowerCase()));
      } else if (typeof routeOther === 'string') {
        routeOther.split(',').forEach((v: string) => { if (v.trim()) officialVillages.add(v.trim().toLowerCase()); });
      }
    });

    const [farmersRes, draftsRes, farmCardsRes, tempDealersRes] = await Promise.all([
      supabase.from('farmers').select('*, profiles:se_id(name)').eq('se_id', se.id).eq('status', 'SUBMITTED'),
      supabase.from('drafts').select('*, profiles:se_id(name)').eq('se_id', se.id).eq('entity_type', 'farmer'),
      (supabase as any).from('farm_cards').select('id, farmer_id, boundary_polygon, status').eq('se_id', se.id), 
      (supabase as any).from('temp_dealers').select('*') 
    ]);

    setTempDealers(tempDealersRes.data || []);
    setFarmCards(farmCardsRes.data || []); 

    // 🚀 NEW: Fetch Farm Diaries correctly and link them
    const farmerIds = (farmersRes.data || []).map(f => f.id);
    let currentFarmDiaries: any[] = [];
    
    if (farmerIds.length > 0) {
      const { data: diaryData } = await (supabase as any)
        .from('farm_diary')
        .select('id, farmer_id, farm_name, diary_polygon')
        .in('farmer_id', farmerIds);
        
      currentFarmDiaries = diaryData || [];
      setFarmDiaries(currentFarmDiaries);
    } else {
      setFarmDiaries([]);
    }

    const farmersWithCards = new Set((farmCardsRes.data || []).map((fc: any) => fc.farmer_id));
    const farmersWithDiaries = new Set(currentFarmDiaries.map((fd: any) => fd.farmer_id)); // 🚀 Build Set of Diaries

    const submittedFarmers = (farmersRes.data || []).map(f => ({
      ...f,
      has_farm_card: farmersWithCards.has(f.id),
      has_farm_diary: farmersWithDiaries.has(f.id) // 🚀 Attach the flag to the actual farmer
    }));

    const draftFarmers = (draftsRes.data || []).map(draft => {
        const data = draft.draft_data as any; 
        const id = draft.entity_id || draft.id;
        return {
          id,
          status: 'DRAFT',
          is_draft: true,
          full_name: data?.fullName || data?.full_name || 'Unnamed Draft', 
          mobile: data?.mobile || 'No Mobile',
          village: data?.village || data?.personal_details?.village || '',
          created_at: draft.created_at,
          updated_at: draft.updated_at,
          fspp_details: data?.fspp_details || {},
          has_farm_card: farmersWithCards.has(id),
          has_farm_diary: farmersWithDiaries.has(id), // 🚀 Attach flag to drafts just in case
          personal_details: { village: data?.village || data?.personal_details?.village || '' },
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
      setDisplayRoutes([...pureRoutes, othersRoute]);
    } else {
      setDisplayRoutes(pureRoutes);
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
    if (!route) return []; 
    
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

  const getDealersForVillage = (villageName: string) => {
    const vSafe = villageName.trim().toLowerCase();
    return tempDealers.filter(d => {
      const vName = d.village || d.Village || d.VILLAGE || '';
      return String(vName).trim().toLowerCase() === vSafe;
    });
  };

  const getDealersForRoute = (route: any) => {
    let routeDealers: any[] = [];
    if (route.is_custom_others) {
      route.locations[0].villages.forEach((v: string) => { 
        routeDealers = [...routeDealers, ...getDealersForVillage(v)]; 
      });
    } else {
      route.locations?.forEach((loc: any) => {
        loc.villages?.forEach((v: string) => { 
          routeDealers = [...routeDealers, ...getDealersForVillage(v)]; 
        });
      });
    }
    return routeDealers;
  };


  if (!se) return null;

  const getPolygonsForFarmers = (farmersList: any[]) => {
    const ids = new Set(farmersList.map(f => f.id));
    const polygons: MapPolygonFeature[] = [];

    farmCards.forEach(fc => {
      if (ids.has(fc.farmer_id) && Array.isArray(fc.boundary_polygon) && fc.boundary_polygon.length > 2) {
        polygons.push({
          id: `fc-${fc.id}`,
          title: `Farm Card Plot`,
          type: 'Farm Card',
          coords: fc.boundary_polygon
        });
      }
    });

    farmDiaries.forEach(fd => {
      if (ids.has(fd.farmer_id) && Array.isArray(fd.diary_polygon) && fd.diary_polygon.length > 2) {
        polygons.push({
          id: `fd-${fd.id}`,
          title: fd.farm_name || 'Farm Diary Plot',
          type: 'Farm Diary',
          coords: fd.diary_polygon
        });
      }
    });
    
    return polygons;
  };

  const getFarmCardMetricsForFarmers = (farmersList: any[]) => {
    const ids = new Set(farmersList.map(f => f.id));
    const relevantCards = farmCards.filter(fc => ids.has(fc.farmer_id));
    return {
      total: relevantCards.length,
      drafts: relevantCards.filter(c => c.status === 'DRAFT').length,
      completed: relevantCards.filter(c => c.status !== 'DRAFT').length
    };
  };

  // 🚀 NEW: Helper to securely pass Farm Diary metrics for specific groups
  const getFarmDiaryMetricsForFarmers = (farmersList: any[]) => {
    const ids = new Set(farmersList.map(f => f.id));
    const relevantDiaries = farmDiaries.filter(fd => ids.has(fd.farmer_id));
    return relevantDiaries.length;
  };

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
                
                {/* ---------- ROUTE LEVEL ---------- */}
                {level === 'routes' && (
                  <Tabs defaultValue="list" className="w-full">
                    <TabsList className="w-full bg-muted/50 p-1 mb-4 grid grid-cols-4">
                      <TabsTrigger value="list" className="gap-2"><MapIcon className="h-4 w-4" /> Routes</TabsTrigger>
                      <TabsTrigger value="dealers" className="gap-2"><Store className="h-4 w-4" /> Dealers</TabsTrigger>
                      <TabsTrigger value="analytics" className="gap-2"><TrendingUp className="h-4 w-4" /> Analytics</TabsTrigger>
                      <TabsTrigger value="map" className="gap-2"><MapIcon className="h-4 w-4" /> Map</TabsTrigger>
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

                    <TabsContent value="dealers" className="space-y-4 outline-none">
                      {displayRoutes.map((route: any) => {
                        const dealers = getDealersForRoute(route);
                        if (dealers.length === 0) return null;
                        
                        return (
                          <div key={`dlr-rt-${route.id}`} className="mb-6">
                            <h3 className="font-bold text-primary mb-3 px-1">{route.name} <span className="text-muted-foreground text-sm font-medium">({dealers.length} Dealers)</span></h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                              {dealers.map((d, idx) => <WebDealerCard key={idx} dealer={d} />)}
                            </div>
                          </div>
                        );
                      })}
                      {displayRoutes.every(r => getDealersForRoute(r).length === 0) && (
                        <div className="text-center py-10 text-muted-foreground text-sm font-medium">No registered prospect dealers found across these routes.</div>
                      )}
                    </TabsContent>
                    
                    <TabsContent value="analytics" className="outline-none">
                      <AnalyticsTable 
                        entities={displayRoutes.map((route: any) => ({
                          name: route.name,
                          farmers: getFarmersForRoute(route),
                          villageCount: getVillageCountForRoute(route),
                          externalFarmCardCount: getFarmCardMetricsForFarmers(getFarmersForRoute(route)),
                          externalFarmDiaryCount: getFarmDiaryMetricsForFarmers(getFarmersForRoute(route)) // 🚀 SECURE COUNT PASSED
                        }))} 
                      />
                    </TabsContent>

                    <TabsContent value="map" className="outline-none h-[65vh] w-full relative">
                      <PolygonMap polygons={getPolygonsForFarmers(farmers)} />
                    </TabsContent>
                  </Tabs>
                )}

                {/* ---------- VILLAGES LEVEL ---------- */}
                {level === 'villages' && activeRoute && (
                  <Tabs defaultValue="list" className="w-full">
                    <TabsList className="w-full bg-muted/50 p-1 mb-4 grid grid-cols-4">
                      <TabsTrigger value="list" className="gap-2"><MapPin className="h-4 w-4" /> Villages</TabsTrigger>
                      <TabsTrigger value="dealers" className="gap-2"><Store className="h-4 w-4" /> Dealers</TabsTrigger>
                      <TabsTrigger value="analytics" className="gap-2"><TrendingUp className="h-4 w-4" /> Analytics</TabsTrigger>
                      <TabsTrigger value="map" className="gap-2"><MapIcon className="h-4 w-4" /> Map</TabsTrigger>
                    </TabsList>
                    
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

                    <TabsContent value="dealers" className="space-y-4 outline-none">
                      {activeRoute.locations?.flatMap((loc: any) => loc.villages || []).map((v: string) => {
                        const dealers = getDealersForVillage(v);
                        if (dealers.length === 0) return null;

                        return (
                          <div key={`dlr-vl-${v}`} className="mb-6">
                            <h3 className="font-bold text-primary mb-3 px-1">{v} <span className="text-muted-foreground text-sm font-medium">({dealers.length} Dealers)</span></h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                              {dealers.map((d, idx) => <WebDealerCard key={idx} dealer={d} />)}
                            </div>
                          </div>
                        );
                      })}
                      {activeRoute.locations?.flatMap((loc: any) => loc.villages || []).every((v: string) => getDealersForVillage(v).length === 0) && (
                        <div className="text-center py-10 text-muted-foreground text-sm font-medium">No registered prospect dealers found in these villages.</div>
                      )}
                    </TabsContent>

                    <TabsContent value="analytics" className="outline-none">
                      <AnalyticsTable 
                        entities={(activeRoute.locations?.flatMap((loc: any) => loc.villages || []) || []).map((v: string) => ({
                          name: v,
                          farmers: getFarmersForVillage(v),
                          villageCount: 1,
                          externalFarmCardCount: getFarmCardMetricsForFarmers(getFarmersForVillage(v)),
                          externalFarmDiaryCount: getFarmDiaryMetricsForFarmers(getFarmersForVillage(v)) // 🚀 SECURE COUNT PASSED
                        }))} 
                      />
                    </TabsContent>

                    <TabsContent value="map" className="outline-none h-[65vh] w-full relative">
                      <PolygonMap polygons={getPolygonsForFarmers(activeRoute.locations?.flatMap((loc: any) => loc.villages || []).flatMap((v: string) => getFarmersForVillage(v)) || [])} />
                    </TabsContent>
                  </Tabs>
                )}

                {/* ---------- FARMERS LEVEL (Specific Village Selected) ---------- */}
                {level === 'farmers' && activeVillage && (
                  <Tabs defaultValue="list" className="w-full">
                    <TabsList className="w-full bg-muted/50 p-1 mb-4 grid grid-cols-4">
                      <TabsTrigger value="list" className="gap-2"><Users className="h-4 w-4" /> Farmers</TabsTrigger>
                      <TabsTrigger value="dealers" className="gap-2"><Store className="h-4 w-4" /> Dealers</TabsTrigger>
                      <TabsTrigger value="analytics" className="gap-2"><TrendingUp className="h-4 w-4" /> Analytics</TabsTrigger>
                      <TabsTrigger value="map" className="gap-2"><MapIcon className="h-4 w-4" /> Map</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="analytics" className="outline-none">
                      <AnalyticsTable 
                        entities={[{
                          name: activeVillage,
                          farmers: getFarmersForVillage(activeVillage),
                          villageCount: 1,
                          externalFarmCardCount: getFarmCardMetricsForFarmers(getFarmersForVillage(activeVillage)),
                          externalFarmDiaryCount: getFarmDiaryMetricsForFarmers(getFarmersForVillage(activeVillage)) // 🚀 SECURE COUNT PASSED
                        }]} 
                      />
                    </TabsContent>

                    <TabsContent value="dealers" className="space-y-4 outline-none">
                      {(() => {
                        const dealers = getDealersForVillage(activeVillage);
                        if (dealers.length === 0) {
                          return (
                            <div className="text-center py-10 text-muted-foreground text-sm font-medium">
                              No registered prospect dealers found in {activeVillage}.
                            </div>
                          );
                        }
                        
                        return (
                          <div className="mb-6">
                            <h3 className="font-bold text-primary mb-3 px-1">
                              {activeVillage} <span className="text-muted-foreground text-sm font-medium">({dealers.length} Dealers)</span>
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                              {dealers.map((d, idx) => <WebDealerCard key={idx} dealer={d} />)}
                            </div>
                          </div>
                        );
                      })()}
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

                    <TabsContent value="map" className="outline-none h-[65vh] w-full relative">
                      <PolygonMap polygons={getPolygonsForFarmers(getFarmersForVillage(activeVillage))} />
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