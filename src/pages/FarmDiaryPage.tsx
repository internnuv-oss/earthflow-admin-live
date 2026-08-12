import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { Loader2, Shield, Download, Search, BookOpen, MapPin, User, Leaf, UserCircle, Clock, Calendar as CalendarIcon, CalendarClock, CheckCircle2, AlertCircle, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

// Utility to format date as dd-mm-yy
const formatDDMMYY = (dateVal: string | Date | null | undefined) => {
  if (!dateVal) return 'N/A';
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return 'N/A';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = String(d.getFullYear()).slice(-2);
  return `${day}-${month}-${year}`;
};

const FarmDiaryPage = ({ onLogout }: { onLogout: () => void }) => {
  const { session, loading: authLoading } = useAuth();
  const userId = session?.user?.id;
  
  const { getModulePerm, loading: permLoading } = usePermissions(userId || '');
  const diaryAccess = getModulePerm('farm_diary_masters'); 
  
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [diaries, setDiaries] = useState<any[]>([]);

  // Master Lists for Filters
  const [seList, setSeList] = useState<{id: string, name: string}[]>([]);
  const [cropsList, setCropsList] = useState<{id: string, name: string}[]>([]);
  const [stagesList, setStagesList] = useState<{id: string, name: string}[]>([]);
  
  // Mapping data for upcoming events calculation
  const [cropStagesMap, setCropStagesMap] = useState<Record<string, any[]>>({});

  // ON-SCREEN FILTERS
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSE, setSelectedSE] = useState('All');
  const [selectedCrop, setSelectedCrop] = useState('All');
  const [selectedStage, setSelectedStage] = useState('All');
  
  // Sorting State for Table Columns
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'created_at', direction: 'desc' });
  
  // Forecasting Date Range Filters
  const [forecastStart, setForecastStart] = useState('');
  const [forecastEnd, setForecastEnd] = useState('');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 15;

  // DIARY DETAILS SHEET STATES
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [selectedDiary, setSelectedDiary] = useState<any | null>(null);
  const [observationSessions, setObservationSessions] = useState<any[]>([]);
  const [sopTemplateStages, setSopTemplateStages] = useState<any[]>([]);
  const [loadingObservations, setLoadingObservations] = useState(false);

  // 1. Fetch Master Data & SOP Arrays
  useEffect(() => {
    if (!userId || !diaryAccess.can_view) return;

    supabase.from('profiles').select('id, name').eq('role', 'SE').or('is_demo.eq.false,is_demo.is.null').order('name')
      .then(({ data }) => { if (data) setSeList(data); });

    supabase.from('master_crops').select('id, crop_name').order('crop_name')
      .then(({ data }) => { if (data) setCropsList(data.map(c => ({ id: c.id, name: c.crop_name }))); });

    supabase.from('master_crop_stages').select('id, stage_name').order('stage_name')
      .then(({ data }) => { if (data) setStagesList(data.map(s => ({ id: s.id, name: s.stage_name }))); });

    // Fetch SOP logic and build arrays for calculating the "Upcoming Event"
    supabase.from('sop_crop_stages')
      .select('crop_id, stage_id, stage_sequence, master_crop_stages ( stage_name ), sop_applications ( das )')
      .then(({ data }) => {
        if (data) {
          const stageMap: Record<string, any[]> = {};

          data.forEach(stage => {
            const apps = stage.sop_applications || [];
            if (apps.length > 0) {
              const minDas = Math.min(...apps.map((a: any) => Number(a.das)));
              if (!stageMap[stage.crop_id]) stageMap[stage.crop_id] = [];
              stageMap[stage.crop_id].push({
                stage_id: stage.stage_id,
                stage_sequence: stage.stage_sequence || 0,
                stage_name: stage.master_crop_stages?.stage_name || 'Unknown',
                das: minDas
              });
            }
          });

          // Sort stages logically by SOP sequence mapping so we always grab the true "next" stage
          Object.keys(stageMap).forEach(k => {
            stageMap[k].sort((a, b) => a.stage_sequence - b.stage_sequence);
          });

          setCropStagesMap(stageMap);
        }
      });
  }, [userId, diaryAccess.can_view]);

  // 2. Fetch Farm Diaries List
  useEffect(() => {
    if (!userId || !diaryAccess.can_view) return;

    const fetchDiaries = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('farm_diary')
        .select(`
          *,
          farmers ( full_name, village, se_id, profiles:se_id ( name ) ),
          crop_observation_sessions ( selected_crop_id, selected_stage_id, master_crops ( crop_name ), master_crop_stages ( stage_name ) )
        `)
        .order('created_at', { ascending: false });

      if (error) toast({ title: 'Error fetching data', description: error.message, variant: 'destructive' });
      else if (data) setDiaries(data);
      
      setLoading(false);
    };

    fetchDiaries();
  }, [userId, diaryAccess.can_view, toast]);

  // UTILITY: Get Crop ID dynamically from Farm Name string
  const getCropIdFromName = (farmName: string | null) => {
    if (!farmName) return null;
    const match = cropsList.find(c => c.name.toLowerCase() === farmName.toLowerCase());
    return match?.id || null;
  };

  // 3. Fetch Deep Observation Details for Slide-out Sheet
  useEffect(() => {
    if (selectedDiary && isSheetOpen) {
      setLoadingObservations(true);
      
      // Farm Name is the Crop Name -> Map to master_crops ID
      const targetCropId = getCropIdFromName(selectedDiary.farm_name);

      supabase.from('crop_observation_sessions')
        .select(`
          id, created_at, overall_plant_health_score, expected_yield_potential, action_required_tier, executive_notes, days_after_sowing_das,
          selected_crop_id, selected_stage_id,
          master_crops ( crop_name ),
          master_crop_stages ( stage_name ),
          plant_sample_sets (
            id, sample_set_index, sample_photo_file_path,
            sample_parameter_values ( id, logged_value_raw, master_parameters ( parameter_label, ui_input_type ), master_uom ( uom_symbol ) )
          )
        `)
        .eq('farm_diary_id', selectedDiary.id)
        .order('created_at', { ascending: false })
        .then(async ({data}: any) => {
          const sessions = data || [];
          setObservationSessions(sessions);
          
          if (targetCropId) {
            const { data: stagesData } = await supabase.from('sop_crop_stages')
               .select(`id, stage_sequence, chemical_recommendation_and_dosage, stage_id, master_crop_stages ( stage_name ), sop_applications ( das )`)
               .eq('crop_id', targetCropId)
               .order('stage_sequence', { ascending: true });
            setSopTemplateStages(stagesData || []);
          } else {
            setSopTemplateStages([]);
          }
          setLoadingObservations(false);
        });
    }
  }, [selectedDiary, isSheetOpen, cropsList]);

  // Reset page when any filter changes
  useEffect(() => setCurrentPage(1), [searchTerm, selectedSE, selectedCrop, selectedStage, forecastStart, forecastEnd, sortConfig]); 

  // 🚀 HYBRID HELPER: Uses Sequence if there are visits, uses Calendar Date if NO visits yet
  const getUpcomingStage = (diary: any) => {
    if (!diary.is_sowing_done || !diary.sowing_date) return null;
    
    // Farm Name represents the Crop -> Extract specific crop ID
    const cropId = getCropIdFromName(diary.farm_name);
    if (!cropId) return null; 

    const stages = cropStagesMap[cropId] || [];
    if (stages.length === 0) return null;

    const sessions = diary.crop_observation_sessions || [];
    const completedStageIds = new Set(sessions.map((s: any) => s.selected_stage_id));

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const sowingDate = new Date(diary.sowing_date);
    sowingDate.setHours(0, 0, 0, 0);

    let nextStage;

    if (sessions.length > 0) {
      // SCENARIO 1: Executive HAS visited. 
      // Find the highest sequence completed and strictly show the one after it.
      let maxCompletedSeq = -1;
      stages.forEach(s => {
        if (completedStageIds.has(s.stage_id) && s.stage_sequence > maxCompletedSeq) {
          maxCompletedSeq = s.stage_sequence;
        }
      });
      nextStage = stages.find(s => s.stage_sequence > maxCompletedSeq);
    } else {
      // SCENARIO 2: NO visits yet. 
      // Calculate target dates and find the first stage whose target date is on or after today.
      nextStage = stages.find(s => {
        const targetDate = new Date(sowingDate);
        targetDate.setDate(targetDate.getDate() + s.das);
        return targetDate >= today;
      });
      
      // Fallback: If all expected stage dates are already strictly in the past, 
      // default back to showing the very first stage so it registers as overdue.
      if (!nextStage) {
        nextStage = stages[0];
      }
    }

    // If they have completed the final stage in the SOP
    if (!nextStage) {
      return { stage_id: 'COMPLETED', name: 'All Stages Completed', date: null, isOverdue: false };
    }

    const date = new Date(sowingDate);
    date.setDate(date.getDate() + nextStage.das);
    const isOverdue = date < today;

    return { stage_id: nextStage.stage_id, name: nextStage.stage_name, date, isOverdue };
  };

  // ADVANCED FILTERING: Stage and Forecast strictly apply to the Upcoming Event!
  const filteredData = diaries.filter((diary) => {
    const diarySEId = diary.farmers?.se_id;
    const matchesSE = selectedSE === 'All' || diarySEId === selectedSE;
    
    const diaryCropId = getCropIdFromName(diary.farm_name);
    const matchesCrop = selectedCrop === 'All' || diaryCropId === selectedCrop;
    
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = searchTerm === '' || 
      (diary.farm_name || '').toLowerCase().includes(searchLower) ||
      (diary.farmers?.full_name || '').toLowerCase().includes(searchLower) ||
      (diary.farmers?.village || '').toLowerCase().includes(searchLower);

    const upcoming = getUpcomingStage(diary);

    let matchesStage = true;
    if (selectedStage !== 'All') {
      matchesStage = upcoming !== null && upcoming.stage_id === selectedStage;
    }

    let matchesForecast = true;
    if (forecastStart && forecastEnd) {
      matchesForecast = false; 
      if (upcoming && upcoming.date) {
        const start = new Date(forecastStart);
        start.setHours(0, 0, 0, 0);
        const end = new Date(forecastEnd);
        end.setHours(23, 59, 59, 999);
        if (upcoming.date >= start && upcoming.date <= end) matchesForecast = true;
      }
    }
    
    return matchesSE && matchesCrop && matchesStage && matchesSearch && matchesForecast;
  });

  // TABLE SORTING LOGIC
  const sortedData = [...filteredData].sort((a, b) => {
    let valA: any, valB: any;

    switch (sortConfig.key) {
      case 'created_at':
        valA = new Date(a.created_at).getTime();
        valB = new Date(b.created_at).getTime();
        break;
      case 'farm_name':
        valA = (a.farm_name || '').toLowerCase();
        valB = (b.farm_name || '').toLowerCase();
        break;
      case 'farmer_name':
        valA = (a.farmers?.full_name || '').toLowerCase();
        valB = (b.farmers?.full_name || '').toLowerCase();
        break;
      case 'executive':
        valA = (a.farmers?.profiles?.name || '').toLowerCase();
        valB = (b.farmers?.profiles?.name || '').toLowerCase();
        break;
      case 'visits': // Added sorting for Visits
        valA = new Set(a.crop_observation_sessions?.map((s: any) => s.selected_stage_id)).size;
        valB = new Set(b.crop_observation_sessions?.map((s: any) => s.selected_stage_id)).size;
        break;
      case 'upcoming_date':
        const upA = getUpcomingStage(a);
        const upB = getUpcomingStage(b);
        valA = upA?.date ? upA.date.getTime() : 0;
        valB = upB?.date ? upB.date.getTime() : 0;
        break;
      default:
        return 0;
    }

    if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
    if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });
  
  const totalPages = Math.ceil(sortedData.length / ITEMS_PER_PAGE) || 1;
  const paginatedData = sortedData.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const handleSort = (key: string) => {
    setSortConfig(current => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const SortIndicator = ({ sortKey }: { sortKey: string }) => {
    if (sortConfig.key !== sortKey) return <ArrowUpDown className="h-3 w-3 opacity-30 group-hover:opacity-100 transition-opacity" />;
    return sortConfig.direction === 'asc' ? <ArrowUp className="h-3 w-3 text-primary" /> : <ArrowDown className="h-3 w-3 text-primary" />;
  };

  const executeExport = () => {
    if (sortedData.length === 0) return toast({ title: 'No Data', description: 'No records match your filters to export.' });

    const headers = ['Created Date', 'Farm/Diary Name (Crop)', 'Farmer Name', 'Village', 'Executive (SE)', 'Area', 'Sowing Date', 'Visits', 'Upcoming Stage', 'Upcoming Stage Date', 'Is Overdue'];
    const csvRows = [headers.join(',')];
    
    // Use sortedData for export so it matches the UI
    sortedData.forEach(diary => {
      const area = `${diary.plot_area || 0} ${diary.plot_area_unit || 'Acres'}`;
      const sowingDate = diary.sowing_date ? formatDDMMYY(diary.sowing_date) : 'N/A';
      const visitsCount = new Set(diary.crop_observation_sessions?.map((s: any) => s.selected_stage_id)).size;
      
      const upcoming = getUpcomingStage(diary);
      const upcomingName = upcoming ? upcoming.name : 'N/A';
      const upcomingDate = upcoming && upcoming.date ? formatDDMMYY(upcoming.date) : 'N/A';
      const isOverdue = upcoming && upcoming.isOverdue ? 'Yes' : 'No';

      const row = [
        `"${formatDDMMYY(diary.created_at)}"`,
        `"${(diary.farm_name || 'Unnamed').replace(/"/g, '""')}"`,
        `"${(diary.farmers?.full_name || 'Unknown').replace(/"/g, '""')}"`,
        `"${(diary.farmers?.village || 'Unknown').replace(/"/g, '""')}"`,
        `"${(diary.farmers?.profiles?.name || 'Unknown').replace(/"/g, '""')}"`,
        `"${area}"`,
        `"${sowingDate}"`,
        `"${visitsCount}"`,
        `"${upcomingName}"`,
        `"${upcomingDate}"`,
        `"${isOverdue}"`
      ];
      csvRows.push(row.join(','));
    });

    const blob = new Blob(['\uFEFF' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Farm_Diaries_Export_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
    toast({ title: 'Export Successful', description: 'Your file is downloading.' });
  };

  const openDiaryDetails = (diary: any) => {
    setSelectedDiary(diary);
    setIsSheetOpen(true);
  };

  if (authLoading || permLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  if (!diaryAccess.can_view) {
    return (
      <AppLayout onLogout={onLogout}>
        <div className="flex flex-col items-center justify-center h-[60vh] text-center">
          <Shield className="h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold">Access Denied</h2>
          <p className="text-muted-foreground">You do not have permission to view Farm Diaries.</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout onLogout={onLogout}>
      <div className="space-y-6 animate-in fade-in duration-300">
        
        {/* Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" /> Farm Diaries Directory
            </h2>
            <p className="text-sm text-muted-foreground">
              Monitor field plots and dynamically filter by Upcoming Events.
            </p>
          </div>

          <Button variant="outline" className="bg-green-50 text-green-700 hover:bg-green-100 border-green-200 w-full lg:w-auto" onClick={executeExport}>
            <Download className="h-4 w-4 mr-2" /> Export Filtered CSV
          </Button>
        </div>

        {/* Filters Bar */}
        <div className="bg-card border rounded-lg p-3 shadow-sm flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
            <div className="relative flex items-center w-full sm:w-auto flex-1 md:flex-none">
              <Search className="absolute left-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input type="text" placeholder="Search Farmer or Diary..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9 h-9 min-w-[200px]" />
            </div>

            <div className="relative flex items-center w-full sm:w-auto flex-1 md:flex-none">
              <UserCircle className="absolute left-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
              <select value={selectedSE} onChange={(e) => setSelectedSE(e.target.value)} className="flex h-9 w-full min-w-[180px] items-center justify-between rounded-md border border-input bg-transparent pl-9 pr-3 py-2 text-sm shadow-sm focus:outline-none">
                <option value="All">All Executives</option>
                {seList.map(se => <option key={se.id} value={se.id}>{se.name}</option>)}
              </select>
            </div>

            <div className="relative flex items-center w-full sm:w-auto flex-1 md:flex-none">
              <Leaf className="absolute left-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
              <select value={selectedCrop} onChange={(e) => setSelectedCrop(e.target.value)} className="flex h-9 w-full min-w-[180px] items-center justify-between rounded-md border border-input bg-transparent pl-9 pr-3 py-2 text-sm shadow-sm focus:outline-none">
                <option value="All">Select Crop...</option>
                {cropsList.map(crop => <option key={crop.id} value={crop.id}>{crop.name}</option>)}
              </select>
            </div>

            {/* STAGE FILTER APPLIES TO UPCOMING EVENT */}
            <div className="relative flex items-center w-full sm:w-auto flex-1 md:flex-none">
              <Shield className="absolute left-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
              <select value={selectedStage} onChange={(e) => setSelectedStage(e.target.value)} className="flex h-9 w-full min-w-[180px] items-center justify-between rounded-md border border-input bg-transparent pl-9 pr-3 py-2 text-sm shadow-sm focus:outline-none">
                <option value="All">Filter by Upcoming Stage...</option>
                {stagesList.map(stage => <option key={stage.id} value={stage.id}>{stage.name}</option>)}
              </select>
            </div>
          </div>

          {/* FORECASTING CALENDAR */}
          <div className="flex flex-col sm:flex-row items-center gap-3 bg-indigo-50/50 border border-indigo-100 p-2 rounded-md">
            <div className="text-xs font-bold text-indigo-700 flex items-center gap-1.5 px-2">
              <CalendarIcon className="h-4 w-4" /> UPCOMING EVENT DATE:
            </div>
            
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Input type="date" value={forecastStart} onChange={(e) => setForecastStart(e.target.value)} className="h-8 text-xs w-full sm:w-[140px] bg-white" title="Start Date" />
              <span className="text-muted-foreground text-xs font-medium">to</span>
              <Input type="date" value={forecastEnd} onChange={(e) => setForecastEnd(e.target.value)} className="h-8 text-xs w-full sm:w-[140px] bg-white" title="End Date" />
            </div>
            
            {forecastStart && forecastEnd && (
              <Button variant="ghost" size="sm" onClick={() => {setForecastStart(''); setForecastEnd('');}} className="h-8 text-xs text-muted-foreground hover:text-destructive ml-auto">
                Clear Dates
              </Button>
            )}
          </div>
        </div>

        {/* Data Table */}
        <div className="bg-card border rounded-lg shadow-sm flex flex-col overflow-hidden">
          <div className="overflow-x-auto">
            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : (
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="px-4 py-3 font-semibold text-muted-foreground cursor-pointer hover:bg-muted/80 select-none group" onClick={() => handleSort('created_at')}>
                      <div className="flex items-center gap-1.5">Created Date <SortIndicator sortKey="created_at" /></div>
                    </th>
                    <th className="px-4 py-3 font-semibold text-muted-foreground cursor-pointer hover:bg-muted/80 select-none group" onClick={() => handleSort('farm_name')}>
                      <div className="flex items-center gap-1.5">Diary & Plot Details <SortIndicator sortKey="farm_name" /></div>
                    </th>
                    <th className="px-4 py-3 font-semibold text-muted-foreground cursor-pointer hover:bg-muted/80 select-none group" onClick={() => handleSort('farmer_name')}>
                      <div className="flex items-center gap-1.5">Farmer & Village <SortIndicator sortKey="farmer_name" /></div>
                    </th>
                    <th className="px-4 py-3 font-semibold text-muted-foreground cursor-pointer hover:bg-muted/80 select-none group" onClick={() => handleSort('executive')}>
                      <div className="flex items-center gap-1.5">Executive (SE) <SortIndicator sortKey="executive" /></div>
                    </th>
                    <th className="px-4 py-3 font-semibold text-muted-foreground cursor-pointer hover:bg-muted/80 select-none group" onClick={() => handleSort('visits')}>
                      <div className="flex items-center gap-1.5">Visits <SortIndicator sortKey="visits" /></div>
                    </th>
                    <th className="px-4 py-3 font-semibold text-muted-foreground bg-indigo-50/50 cursor-pointer hover:bg-indigo-100 select-none group" onClick={() => handleSort('upcoming_date')}>
                      <div className="flex items-center gap-1.5">Upcoming Event <SortIndicator sortKey="upcoming_date" /></div>
                    </th>
                    <th className="px-4 py-3 font-semibold text-muted-foreground text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {paginatedData.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-muted-foreground">
                        <BookOpen className="h-8 w-8 mx-auto mb-3 opacity-20" />
                        No farm diaries found matching your criteria.
                      </td>
                    </tr>
                  ) : (
                    paginatedData.map((diary) => {
                      const upcoming = getUpcomingStage(diary);
                      const visitsCount = new Set(diary.crop_observation_sessions?.map((s: any) => s.selected_stage_id)).size;

                      return (
                        <tr key={diary.id} onClick={() => openDiaryDetails(diary)} className="hover:bg-muted/20 cursor-pointer transition-colors group">
                          
                          <td className="px-4 py-3 text-muted-foreground font-medium whitespace-nowrap">
                            {formatDDMMYY(diary.created_at)}
                          </td>

                          <td className="px-4 py-3">
                            <div className="font-bold text-foreground">{diary.farm_name || 'Unnamed Diary'}</div>
                            <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
                              <span className="font-medium text-amber-600">{diary.plot_area || 0} {diary.plot_area_unit || 'Acres'}</span>
                              <span>•</span>
                              <span>{diary.soil_type || 'N/A Soil'}</span>
                            </div>
                          </td>

                          <td className="px-4 py-3">
                            <div className="font-semibold flex items-center gap-1.5"><User className="h-3.5 w-3.5 text-muted-foreground" /> {diary.farmers?.full_name || 'Unknown'}</div>
                            <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5"><MapPin className="h-3 w-3" /> {diary.farmers?.village || 'Unknown Village'}</div>
                          </td>

                          <td className="px-4 py-3 text-foreground font-medium">
                            {diary.farmers?.profiles?.name || '—'}
                          </td>

                          <td className="px-4 py-3">
                            <Badge variant="secondary" className="bg-slate-100 text-slate-700">
                              {visitsCount}
                            </Badge>
                          </td>

                          <td className="px-4 py-3 bg-indigo-50/20">
                            {upcoming ? (
                              upcoming.date ? (
                                <div className="flex flex-col gap-1">
                                  <span className={cn("text-xs font-bold truncate max-w-[200px]", upcoming.isOverdue ? "text-red-700" : "text-indigo-700")}>
                                    {upcoming.name}
                                  </span>
                                  <span className={cn("text-[10px] flex items-center gap-1 font-semibold", upcoming.isOverdue ? "text-red-600" : "text-muted-foreground")}>
                                    {upcoming.isOverdue ? <AlertCircle className="h-3 w-3 text-red-500" /> : <CalendarClock className="h-3 w-3 text-indigo-500" />} 
                                    {formatDDMMYY(upcoming.date)}
                                    {upcoming.isOverdue && " (Overdue)"}
                                  </span>
                                </div>
                              ) : (
                                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">{upcoming.name}</Badge>
                              )
                            ) : (
                              <span className="text-xs text-muted-foreground italic opacity-70">Awaiting Sowing Date</span>
                            )}
                          </td>

                          <td className="px-4 py-3 text-right">
                            <Button variant="ghost" size="sm" className="h-8 text-xs font-semibold text-primary group-hover:bg-primary/10">View Timeline</Button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            )}
          </div>

          {!loading && sortedData.length > 0 && (
            <div className="flex flex-col md:flex-row items-center justify-between px-4 py-3 border-t bg-muted/20 gap-4">
              <div className="text-xs text-muted-foreground font-medium w-full md:w-auto text-center md:text-left">
                Showing <span className="text-foreground">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> to <span className="text-foreground">{Math.min(currentPage * ITEMS_PER_PAGE, sortedData.length)}</span> of <span className="text-foreground">{sortedData.length}</span> entries
              </div>
              <div className="flex items-center gap-2 w-full md:w-auto justify-center md:justify-end">
                <Button variant="outline" size="sm" className="h-8 px-3 text-xs" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>Prev</Button>
                <div className="text-xs font-semibold px-2">Page {currentPage} of {totalPages}</div>
                <Button variant="outline" size="sm" className="h-8 px-3 text-xs" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Next</Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* FARM DIARY DETAILS SLIDE-OUT SHEET */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-2xl lg:max-w-3xl p-0 flex flex-col bg-slate-50">
          <SheetHeader className="px-6 py-5 border-b border-border bg-white shadow-sm z-10 flex flex-row items-center justify-between">
            <div>
              <SheetTitle className="text-xl">{selectedDiary?.farm_name || 'Farm Diary Details'}</SheetTitle>
              <SheetDescription className="text-primary font-semibold mt-1">
                {selectedDiary?.farmers?.full_name} • {selectedDiary?.farmers?.village}
              </SheetDescription>
            </div>
          </SheetHeader>

          <ScrollArea className="flex-1 px-6 py-6">
            <div className="space-y-6">
              
              <div className="flex gap-2 mb-2 overflow-x-auto pb-2">
                 <Badge className={selectedDiary?.is_sowing_done ? "bg-green-100 text-green-800 border-green-200" : "bg-slate-100 text-slate-800 border-slate-200"}>
                   {selectedDiary?.is_sowing_done ? "Sowing Done" : "Pre-Sowing"}
                 </Badge>
                 {selectedDiary?.sowing_date && (
                   <Badge variant="outline">Sown: {formatDDMMYY(selectedDiary.sowing_date)}</Badge>
                 )}
              </div>

              {/* PLOT, WATER, & HISTORICAL METRICS */}
              <div className="space-y-4">
                 <div className="bg-white p-4 rounded-xl border shadow-sm space-y-3">
                   <h3 className="text-sm font-bold text-foreground border-b pb-2">Plot & Soil Profile</h3>
                   <div className="grid grid-cols-2 md:grid-cols-3 gap-y-4 gap-x-2">
                     <div><p className="text-xs text-muted-foreground">Area</p><p className="text-sm font-semibold">{selectedDiary?.plot_area || 0} {selectedDiary?.plot_area_unit || 'Acres'}</p></div>
                     <div><p className="text-xs text-muted-foreground">Land Status</p><p className="text-sm font-semibold">{selectedDiary?.land_status || 'N/A'}</p></div>
                     <div><p className="text-xs text-muted-foreground">Soil Type</p><p className="text-sm font-semibold">{selectedDiary?.soil_type || 'N/A'}</p></div>
                     <div><p className="text-xs text-muted-foreground">Soil pH</p><p className="text-sm font-semibold">{selectedDiary?.soil_ph || 'N/A'}</p></div>
                     <div><p className="text-xs text-muted-foreground">Soil EC (mS/cm)</p><p className="text-sm font-semibold">{selectedDiary?.soil_ec_ms_cm || 'N/A'}</p></div>
                     <div><p className="text-xs text-muted-foreground">Organic Matter %</p><p className="text-sm font-semibold">{selectedDiary?.organic_matter_percentage || 'N/A'}</p></div>
                     <div><p className="text-xs text-muted-foreground">Drainage</p><p className="text-sm font-semibold">{selectedDiary?.drainage_condition || 'N/A'}</p></div>
                     <div><p className="text-xs text-muted-foreground">Test Status</p><p className="text-sm font-semibold">{selectedDiary?.soil_test_status || 'N/A'}</p></div>
                   </div>
                 </div>

                 <div className="bg-white p-4 rounded-xl border shadow-sm space-y-3">
                   <h3 className="text-sm font-bold text-foreground border-b pb-2">Nutrient & Water Metrics</h3>
                   <div className="grid grid-cols-2 md:grid-cols-3 gap-y-4 gap-x-2">
                     <div><p className="text-xs text-muted-foreground">Nitrogen (kg/ha)</p><p className="text-sm font-semibold">{selectedDiary?.nitrogen_kg_ha || 'N/A'}</p></div>
                     <div><p className="text-xs text-muted-foreground">Phosphorus (kg/ha)</p><p className="text-sm font-semibold">{selectedDiary?.phosphorus_kg_ha || 'N/A'}</p></div>
                     <div><p className="text-xs text-muted-foreground">Potassium (kg/ha)</p><p className="text-sm font-semibold">{selectedDiary?.potassium_kg_ha || 'N/A'}</p></div>
                     <div><p className="text-xs text-muted-foreground">Water Source</p><p className="text-sm font-semibold">{selectedDiary?.water_source || 'N/A'}</p></div>
                     <div><p className="text-xs text-muted-foreground">Irrigation Method</p><p className="text-sm font-semibold">{selectedDiary?.irrigation_method || 'N/A'}</p></div>
                     <div><p className="text-xs text-muted-foreground">Water TDS</p><p className="text-sm font-semibold">{selectedDiary?.water_tds || 'N/A'}</p></div>
                     <div><p className="text-xs text-muted-foreground">Water pH</p><p className="text-sm font-semibold">{selectedDiary?.water_ph || 'N/A'}</p></div>
                   </div>
                 </div>

                 <div className="bg-white p-4 rounded-xl border shadow-sm space-y-3">
                   <h3 className="text-sm font-bold text-foreground border-b pb-2">Historical Context</h3>
                   <div className="grid grid-cols-1 md:grid-cols-3 gap-y-4 gap-x-2">
                     <div><p className="text-xs text-muted-foreground">Decision Making Factor</p><p className="text-sm font-semibold">{selectedDiary?.decision_making_factor || 'N/A'}</p></div>
                     <div><p className="text-xs text-muted-foreground">Yield History</p><p className="text-sm font-semibold">{Array.isArray(selectedDiary?.multi_season_yield_history) ? `${selectedDiary.multi_season_yield_history.length} records mapped` : 'None'}</p></div>
                     <div><p className="text-xs text-muted-foreground">Input Preferences</p><p className="text-sm font-semibold">{Object.keys(selectedDiary?.historical_input_preferences || {}).length > 0 ? 'Customized' : 'None'}</p></div>
                   </div>
                 </div>
              </div>

              {/* CHRONOLOGICAL CROP OBSERVATION ACCORDION */}
              <div className="mt-8">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Leaf className="h-5 w-5 text-green-600"/> Crop Observation Timeline</h3>
                
                {loadingObservations ? (
                  <div className="py-12 flex flex-col items-center justify-center text-sm text-muted-foreground border rounded-xl border-dashed bg-white">
                    <Loader2 className="h-6 w-6 animate-spin mb-3 text-primary" /> Fetching field observations...
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-bold text-foreground">
                        Tracking Crop: <span className="text-primary text-base">
                          {selectedDiary?.farm_name || 'Assigned Crop'}
                        </span>
                      </span>
                    </div>
                    
                    <Accordion type="multiple" className="w-full space-y-3">
                      {sopTemplateStages.length === 0 ? (
                        <div className="text-center py-8 bg-slate-50 border border-dashed rounded-xl text-muted-foreground text-sm">
                           No stages configured for this crop.
                        </div>
                      ) : sopTemplateStages.map((sopStage) => {
                        const stageSessions = observationSessions.filter(s => s.selected_stage_id === sopStage.stage_id);
                        const isCompleted = stageSessions.length > 0;
                        
                        const apps = sopStage.sop_applications || [];
                        const minDas = apps.length > 0 ? Math.min(...apps.map((a: any) => Number(a.das))) : 0;
                        
                        let predictedDateStr = '';
                        let isOverdue = false;
                        if (selectedDiary?.is_sowing_done && selectedDiary?.sowing_date) {
                            const pDate = new Date(selectedDiary.sowing_date);
                            pDate.setDate(pDate.getDate() + minDas);
                            predictedDateStr = formatDDMMYY(pDate);
                            isOverdue = pDate < new Date(new Date().setHours(0,0,0,0)); 
                        }
                        
                        return (
                          <AccordionItem key={sopStage.id} value={sopStage.id} className="border border-border/60 rounded-xl bg-white shadow-sm px-2">
                            <AccordionTrigger className="hover:no-underline py-4 px-3">
                              <div className="flex items-center justify-between w-full pr-2">
                                <div className="flex items-center gap-3">
                                  <div className={cn(
                                    "flex items-center justify-center h-8 w-8 rounded-full text-xs font-bold border shrink-0", 
                                    isCompleted ? "bg-green-100 text-green-700 border-green-200" : "bg-orange-50 text-orange-600 border-orange-200 opacity-60"
                                  )}>
                                    {sopStage.stage_sequence}
                                  </div>
                                  
                                  <div className="flex flex-col items-start gap-0.5">
                                    <span className={cn("font-bold text-base text-left", !isCompleted && "text-muted-foreground")}>
                                      {sopStage.master_crop_stages?.stage_name}
                                    </span>
                                    {predictedDateStr && !isCompleted && (
                                      <span className={cn("text-[10px] font-semibold flex items-center gap-1 px-1.5 py-0.5 rounded border", isOverdue ? "bg-red-50 text-red-600 border-red-100" : "bg-indigo-50 text-indigo-600 border-indigo-100")}>
                                        {isOverdue ? <AlertCircle className="h-3 w-3" /> : <CalendarClock className="h-3 w-3" />} 
                                        Target: {predictedDateStr} (DAS: {minDas})
                                      </span>
                                    )}
                                    {isCompleted && (
                                      <span className="text-[10px] font-semibold text-green-700 flex items-center gap-1 bg-green-50 px-1.5 py-0.5 rounded border border-green-200">
                                        <CheckCircle2 className="h-3 w-3" /> Completed
                                      </span>
                                    )}
                                  </div>
                                </div>
                                
                                <Badge variant="outline" className={cn(
                                  "ml-auto shrink-0", 
                                  isCompleted ? "border-green-200 bg-green-50 text-green-700" : (isOverdue ? "border-red-200 bg-red-50 text-red-700" : "border-orange-200 bg-orange-50 text-orange-600")
                                )}>
                                  {isCompleted ? 'Completed' : (isOverdue ? 'Overdue' : 'Pending')}
                                </Badge>
                              </div>
                            </AccordionTrigger>
                            
                            <AccordionContent className="pt-2 pb-6 px-3 border-t">
                              {isCompleted ? (
                                <div className="space-y-6 mt-4">
                                  {stageSessions.map((session, sIdx) => (
                                    <div key={session.id} className="border rounded-xl bg-slate-50/50 shadow-sm overflow-hidden">
                                      
                                      <div className="bg-white p-4 border-b">
                                        <div className="flex justify-between items-start mb-2">
                                          <div>
                                            <h4 className="font-bold text-sm text-foreground">Visit Record #{stageSessions.length - sIdx}</h4>
                                            <p className="text-xs text-muted-foreground mt-1">Logged: {formatDDMMYY(session.created_at)}</p>
                                          </div>
                                          <Badge variant="outline" className={cn(
                                            "font-bold", 
                                            session.overall_plant_health_score >= 4 ? "border-green-200 text-green-700 bg-green-50" : 
                                            session.overall_plant_health_score >= 3 ? "border-amber-200 text-amber-700 bg-amber-50" : 
                                            "border-red-200 text-red-700 bg-red-50"
                                          )}>
                                            Health Score: {session.overall_plant_health_score}/5
                                          </Badge>
                                        </div>
                                        
                                        <div className="grid grid-cols-2 gap-2 mt-3 text-sm">
                                          <div><span className="font-semibold text-muted-foreground">DAS:</span> {session.days_after_sowing_das || 'N/A'}</div>
                                          <div>
                                            <span className="font-semibold text-muted-foreground">Action Tier:</span> 
                                            <span className={cn("ml-1 font-medium", session.action_required_tier === 'Red' ? 'text-red-600' : session.action_required_tier === 'Amber' ? 'text-amber-600' : 'text-green-600')}>
                                              {session.action_required_tier || 'N/A'}
                                            </span>
                                          </div>
                                          <div className="col-span-2"><span className="font-semibold text-muted-foreground">Yield Potential:</span> {session.expected_yield_potential || 'N/A'}</div>
                                          {session.executive_notes && <div className="col-span-2 mt-1 p-2 bg-slate-100/50 rounded border text-xs text-slate-700"><span className="font-bold block mb-1">Executive Notes:</span> {session.executive_notes}</div>}
                                        </div>
                                      </div>
                                      
                                      {session.plant_sample_sets && session.plant_sample_sets.length > 0 && (
                                        <div className="p-4 bg-transparent">
                                          <h5 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Plant Samples ({session.plant_sample_sets.length})</h5>
                                          
                                          <div className="grid grid-cols-1 gap-4">
                                            {session.plant_sample_sets.map((sample: any) => (
                                              <div key={sample.id} className="flex gap-4 bg-white p-3 border rounded-lg shadow-sm">
                                                <div className="w-24 h-24 shrink-0 bg-muted rounded-md overflow-hidden border flex items-center justify-center relative group">
                                                  <img 
                                                    src={sample.sample_photo_file_path} 
                                                    alt={`Sample ${sample.sample_set_index}`} 
                                                    className="w-full h-full object-cover" 
                                                    onError={(e) => { e.currentTarget.src = 'https://placehold.co/100x100/f8fafc/94a3b8?text=No+Img'; }} 
                                                  />
                                                  {sample.sample_photo_file_path && (
                                                    <a href={sample.sample_photo_file_path} target="_blank" rel="noreferrer" className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                      <span className="text-white text-xs font-bold">View Full</span>
                                                    </a>
                                                  )}
                                                </div>
                                                
                                                <div className="flex-1 min-w-0">
                                                  <p className="font-bold text-sm mb-1 pb-1 border-b">Plant #{sample.sample_set_index}</p>
                                                  <div className="space-y-1.5 mt-1.5 max-h-24 overflow-y-auto custom-scrollbar pr-1">
                                                    {sample.sample_parameter_values?.map((param: any) => (
                                                      <div key={param.id} className="text-xs flex flex-col gap-0.5 mb-1.5">
                                                        <span className="text-muted-foreground font-medium">{param.master_parameters?.parameter_label}:</span>
                                                        <span className="font-bold text-foreground">
                                                          {param.master_parameters?.ui_input_type === 'Upload Image' ? (
                                                            <a href={param.logged_value_raw} target="_blank" rel="noreferrer" className="text-primary hover:underline">View Attachment</a>
                                                          ) : (
                                                            `${param.logged_value_raw} ${param.master_uom?.uom_symbol || ''}`
                                                          )}
                                                        </span>
                                                      </div>
                                                    ))}
                                                    {(!sample.sample_parameter_values || sample.sample_parameter_values.length === 0) && (
                                                      <span className="text-xs text-muted-foreground italic">No parameters logged</span>
                                                    )}
                                                  </div>
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="py-8 text-center text-muted-foreground bg-slate-50 rounded-xl mt-4 border border-dashed">
                                  <Clock className="h-6 w-6 mx-auto mb-2 opacity-30" />
                                  <p className="text-sm font-semibold">Stage Pending</p>
                                  <p className="text-xs mt-1 max-w-[250px] mx-auto">No field executive observations have been logged for this stage yet.</p>
                                </div>
                              )}
                            </AccordionContent>
                          </AccordionItem>
                        );
                      })}
                    </Accordion>
                  </div>
                )}
              </div>
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

    </AppLayout>
  );
};

export default FarmDiaryPage;