import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter, SheetDescription } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  FileText, Edit, Save, X, Loader2, Plus, Trash2, Check, ChevronsUpDown, 
  ChevronLeft, LayoutDashboard, User, ClipboardCheck, Map as MapIcon, Leaf, ChevronRight
} from 'lucide-react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { KeyValueGrid, Section, fmtKey } from '@/lib/jsonViewer';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { FarmerRow } from './FarmerTable';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';

// --- CONSTANTS ---
const INDIAN_STATES = [
  "Andaman and Nicobar Islands", "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", 
  "Chandigarh", "Chhattisgarh", "Dadra and Nagar Haveli", "Daman and Diu", "Delhi", "Goa", 
  "Gujarat", "Haryana", "Himachal Pradesh", "Jammu and Kashmir", "Jharkhand", "Karnataka", 
  "Kerala", "Ladakh", "Lakshadweep", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", 
  "Mizoram", "Nagaland", "Odisha", "Puducherry", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", 
  "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal"
];

const WEST_INDIA_CROPS = ["Paddy", "Bajra", "Jowar", "Maize", "Other Cereals", "Tur", "Moong", "Math", "Udid", "Other pulses", "Groundnut", "Sesamum", "Castor", "Soyabean", "Other Oilseeds", "Cotton", "Tobacco", "Guar", "Vegetable", "Fodder", "Irri. Wheat", "Unirri. Wheat", "Gram", "Mustard", "Sugarcane", "Cumin", "Coriander", "Garlic", "Sawa", "Isabgul", "Fennel", "Onion", "Potato"];
const SOIL_TYPES = ["Black", "Sandy", "Red", "Loamy", "Others"];
const WATER_SOURCES = ["Canal", "Borewell", "Rain", "Tube-well" ,"Well", "Tank", "Pond","River","Others"];
const IRRIGATION_TYPES = ["Drip", "Sprinkler", "Flood", "Micro-sprinkler", "Rain-fed Only", "Others"];
const TREE_TYPES = ["Mango", "Neem", "Teak", "Coconut", "Lemon", "Papaya", "Others"];
const CATTLE_TYPES = ["Cow", "Buffalo", "Ox / Bull", "Goat / Sheep", "Poultry", "Others"];
const LAND_UNITS = ["Acres", "Bigha"];
const FARM_EQUIPMENTS = ["Mini Tractor", "Tractor", "Cultivation Equipments", "Others"];
const BIOFERTILIZER_OPTS = ["Don't Know", "He knows", "Using"];
const YIELD_UNITS = ["Quintals", "Tonnes", "Kg"];
const INPUTS_USED = ["DAP", "Urea", "NPK", "SSP", "MOP", "Compost", "Others"];

// --- SEARCHABLE MULTI-SELECT ---
const SearchableMultiSelect = ({ label, options, selected, onChange }: { label: string, options: string[], selected: string[], onChange: (val: string[]) => void }) => {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className="w-full justify-between font-normal text-sm bg-background">
          <span className="truncate">{selected.length > 0 ? selected.join(', ') : `Select ${label}...`}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full min-w-[240px] p-0" align="start">
        <Command>
          <CommandInput placeholder={`Search ${label}...`} />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup>
              {options.map((opt) => {
                const isSelected = selected.includes(opt);
                return (
                  <CommandItem key={opt} value={opt} onSelect={() => isSelected ? onChange(selected.filter(x => x !== opt)) : onChange([...selected, opt])}>
                    <div className={cn("mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary", isSelected ? "bg-primary text-primary-foreground" : "opacity-50 [&_svg]:invisible")}>
                      <Check className="h-4 w-4" />
                    </div>
                    <span>{opt}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

// --- SEARCHABLE SINGLE SELECT ---
const SearchableSingleSelect = ({ label, options, value, onChange, placeholder }: { label: string, options: string[], value: string, onChange: (val: string) => void, placeholder?: string }) => {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between font-normal text-sm bg-background">
          <span className="truncate">{value || placeholder || `Select ${label}...`}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full min-w-[240px] p-0" align="start">
        <Command>
          <CommandInput placeholder={`Search ${label}...`} />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup>
              {options.map((opt) => (
                <CommandItem key={opt} value={opt} onSelect={() => { onChange(opt); setOpen(false); }}>
                  <Check className={cn("mr-2 h-4 w-4", value === opt ? "opacity-100" : "opacity-0")} />
                  {opt}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

interface Props { 
  farmer: FarmerRow | null; 
  open: boolean; 
  onClose: () => void;
  onSaved?: () => void;
  canEdit: boolean;
}

const safeArray = (val: any): string[] => {
  if (Array.isArray(val)) return val.map(String);
  if (typeof val === 'string' && val) return val.split(',').map(s => s.trim()).filter(Boolean);
  return [];
};

type ViewState = 'dashboard' | 'profile' | 'fspp' | 'farm_cards' | 'farm_card_detail';

const FarmerDetailSheet = ({ farmer: f, open, onClose, onSaved, canEdit }: Props) => {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const { getModulePerm } = usePermissions(userId || '');
  
  const hasEditAccess = getModulePerm('farmers').can_edit;
  const { toast } = useToast();

  // 🚀 NAVIGATION STATE
  const [view, setView] = useState<ViewState>('dashboard');
  const [farmCards, setFarmCards] = useState<any[]>([]);
  const [selectedFarmCard, setSelectedFarmCard] = useState<any>(null);
 
  // --- EDIT STATE ---
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [fullName, setFullName] = useState('');
  const [mobile, setMobile] = useState('');
  const [village, setVillage] = useState('');
  const [pd, setPd] = useState({ fatherName: '', alternateMobile: '', state: '', city: '', taluka: '', pincode: '' });
  const [fd, setFd] = useState({
    totalLand: '', landUnit: 'Acres', irrigatedLand: '', rainFedLand: '',
    majorCrops: [] as string[], soilType: [] as string[], otherSoilType: '', 
    waterSource: [] as string[], otherWaterSource: '',
    irrigationType: [] as string[], farmEquipments: [] as string[], otherFarmEquipment: '', 
    biofertilizer: '', isIntercropping: ''
  });
  
  const [sideTrees, setSideTrees] = useState<{type: string, quantity: string}[]>([]);
  const [cattles, setCattles] = useState<{type: string, quantity: string}[]>([]);
  const [pastCrops, setPastCrops] = useState<{cropName: string, area: string, areaUnit: string, inputUsed: string[], otherInputUsed: string, yield: string, yieldUnit: string, problemsFaced: string}[]>([]);

  // DB States
  const [dbDistricts, setDbDistricts] = useState<any[]>([]);
  const [dbTalukas, setDbTalukas] = useState<any[]>([]);
  const [dbVillages, setDbVillages] = useState<any[]>([]);

  // 1. Fetch Farm Cards when opened
  useEffect(() => {
    if (f?.id && open) {
      setView('dashboard');
      setIsEditing(false);
      // 🚀 FIXED: Added (supabase as any) to bypass the local schema strict check
      (supabase as any).from('farm_cards').select('*').eq('farmer_id', f.id)
        .then(({data}: any) => setFarmCards(data || []));
    }
  }, [f, open]);

  // 2. Fetch Locations on Edit
  useEffect(() => {
    if (!isEditing) return;
    const fetchDistricts = async () => {
      const { data } = await supabase.from('districts').select('*').order('name');
      if (data) setDbDistricts(data);
    };
    fetchDistricts();
  }, [isEditing]);

  useEffect(() => {
    if (!isEditing || !pd.city) { setDbTalukas([]); return; }
    const selectedDistrict = dbDistricts.find(d => d.name === pd.city);
    if (!selectedDistrict) { setDbTalukas([]); return; }
    const fetchTalukas = async () => {
      const { data } = await supabase.from('talukas').select('*').eq('district_id', selectedDistrict.id).order('name');
      if (data) setDbTalukas(data);
    };
    fetchTalukas();
  }, [pd.city, dbDistricts, isEditing]);

  useEffect(() => {
    if (!isEditing || !pd.taluka) { setDbVillages([]); return; }
    const selectedTaluka = dbTalukas.find(t => t.name === pd.taluka);
    if (!selectedTaluka) { setDbVillages([]); return; }
    const fetchVillages = async () => {
      const { data } = await supabase.from('villages').select('*').eq('taluka_id', selectedTaluka.id).order('name');
      if (data) setDbVillages(data);
    };
    fetchVillages();
  }, [pd.taluka, dbTalukas, isEditing]);

  // Load Data
  useEffect(() => {
    if (f && open) {
      setFullName(f.full_name || '');
      setMobile(f.mobile || '');
      setVillage(f.village || '');
      const p = f.personal_details || {};
      setPd({ fatherName: p.fatherName || '', alternateMobile: p.alternateMobile || '', state: p.state || '', city: p.city || '', taluka: p.taluka || '', pincode: p.pincode || '' });
      const farm = f.farm_details || {};
      setFd({
        totalLand: farm.totalLand || '', landUnit: farm.landUnit || 'Acres', irrigatedLand: farm.irrigatedLand || '', rainFedLand: farm.rainFedLand || '',
        majorCrops: safeArray(farm.majorCrops), soilType: safeArray(farm.soilType), otherSoilType: farm.otherSoilType || '', waterSource: safeArray(farm.waterSource), otherWaterSource: farm.otherWaterSource || '',
        irrigationType: safeArray(farm.irrigationType), farmEquipments: safeArray(farm.farmEquipments), otherFarmEquipment: farm.otherFarmEquipment || '', biofertilizer: farm.biofertilizer || '', isIntercropping: farm.isIntercropping || ''
      });
      setSideTrees(Array.isArray(farm.sideTrees) ? farm.sideTrees : []);
      setCattles(Array.isArray(farm.cattles) ? farm.cattles : []);
      const history = f.history_details || {};
      const crops = Array.isArray(history.pastCrops) ? history.pastCrops : [];
      setPastCrops(crops.map(c => ({ ...c, inputUsed: safeArray(c.inputUsed) })));
    }
  }, [f, open, isEditing]);

  const validateForm = () => {
    if (!fullName.trim() || fullName.trim().length < 2) return "Full Name is required (Min 2 characters).";
    if (!pd.fatherName.trim() || pd.fatherName.trim().length < 2) return "Father's Name is required (Min 2 characters).";
    if (!/^\d{10}$/.test(mobile)) return "Mobile Number must be exactly 10 digits.";
    if (pd.alternateMobile && !/^\d{10}$/.test(pd.alternateMobile)) return "Alternate Mobile must be exactly 10 digits.";
    if (!village.trim() || village.trim().length < 2) return "Village is required.";
    if (!pd.state.trim() || pd.state.trim().length < 2) return "State is required.";
    if (!pd.city.trim() || pd.city.trim().length < 2) return "District is required.";
    if (!pd.taluka.trim() || pd.taluka.trim().length < 2) return "Taluka is required.";
    if (pd.pincode && !/^\d{6}$/.test(pd.pincode)) return "Pincode must be exactly 6 digits.";
    if (!fd.totalLand || parseFloat(fd.totalLand) <= 0) return "Valid Total Land Holding is required.";
    if (fd.majorCrops.length === 0) return "Please select at least one Major Crop.";
    if (fd.soilType.length === 0) return "Please select at least one Soil Type.";
    if (fd.waterSource.length === 0) return "Please select at least one Water Source.";
    if (fd.soilType.includes('Others') && !fd.otherSoilType.trim()) return "Please specify the other Soil Type.";
    if (fd.waterSource.includes('Others') && !fd.otherWaterSource.trim()) return "Please specify the other Water Source.";
    if (fd.farmEquipments.includes('Others') && !fd.otherFarmEquipment.trim()) return "Please specify the other Farm Equipment.";
    return null; 
  };

  const handleSave = async () => {
    if (!f) return;
    const validationError = validateForm();
    if (validationError) return toast({ title: "Validation Error", description: validationError, variant: "destructive" });

    setSaving(true);
    const personal_details = { ...f.personal_details, ...pd };
    const farm_details = { ...f.farm_details, ...fd, sideTrees, cattles };
    const history_details = { ...f.history_details, pastCrops };
    const historyEntry = { timestamp: new Date().toISOString(), action: 'Admin Edited Profile', updated_status: f.status };
    const update_history = [...(f.update_history || []), historyEntry];

    if (f.status === 'DRAFT') {
      const draft_data = { fullName, mobile, village, ...pd, ...fd, sideTrees, cattles, pastCrops };
      const { error } = await (supabase as any).from('drafts').update({ draft_data, updated_at: new Date().toISOString(), update_history }).or(`id.eq.${f.id},entity_id.eq.${f.id}`);
      setSaving(false);
      if (error) return toast({ title: 'Failed to save draft', description: error.message, variant: 'destructive' });
      toast({ title: 'Success', description: 'Farmer Draft updated successfully.' });
      setIsEditing(false);
      if (onSaved) onSaved(); 
      return;
    }

    const { error } = await (supabase as any).from('farmers').update({ full_name: fullName, mobile, village, personal_details, farm_details, history_details, update_history }).eq('id', f.id);
    setSaving(false);
    if (error) toast({ title: 'Failed to save', description: error.message, variant: 'destructive' });
    else {
      toast({ title: 'Success', description: 'Farmer details updated successfully.' });
      setIsEditing(false);
      if (onSaved) onSaved(); 
    }
  };

  const updatePd = (k: string, v: string) => setPd(p => ({ ...p, [k]: v }));
  const updateFd = (k: string, v: any) => setFd(p => ({ ...p, [k]: v }));
  const updateArr = (setter: any, idx: number, key: string, val: any) => setter((prev: any) => prev.map((item: any, i: number) => i === idx ? { ...item, [key]: val } : item));
  const removeArr = (setter: any, idx: number) => setter((prev: any) => prev.filter((_: any, i: number) => i !== idx));

  // 🚀 NAVIGATION LOGIC
  const handleBack = () => {
    if (view === 'farm_card_detail') setView('farm_cards');
    else setView('dashboard');
  };

  if (!f) return null;

  const farmData = f?.farm_details || {};
  const farmRest: Record<string, unknown> = {};
  const arrayFields: Array<[string, any[]]> = [];
  for (const [k, v] of Object.entries(farmData)) {
    if (k !== 'sideTrees' && k !== 'cattles') {
      if (Array.isArray(v) && v.every(x => typeof x === 'string' || typeof x === 'number')) arrayFields.push([k, v]);
      else farmRest[k] = v;
    }
  }
  const viewPastCrops: any[] = (f?.history_details as any)?.pastCrops || [];
  const pastCropKeys = viewPastCrops.length > 0 && typeof viewPastCrops[0] === 'object' ? Array.from(new Set(viewPastCrops.flatMap(c => Object.keys(c || {})))) : [];

  const fspp = (f as any).fspp_details || {};
  const hasFspp = Object.keys(fspp).length > 0;

  return (
    <Sheet open={open} onOpenChange={o => { if (!o) { setIsEditing(false); onClose(); } }}>
      <SheetContent side="right" className="w-full sm:max-w-2xl lg:max-w-3xl p-0 flex flex-col bg-slate-50">
        
        {/* 🚀 HEADER WITH BACK BUTTON */}
        <SheetHeader className="px-6 py-5 border-b border-border bg-white shadow-sm z-10 space-y-4">
          <div className="flex items-center justify-between gap-4">
            
            <div className="flex items-center gap-3 flex-1 min-w-0">
              {view !== 'dashboard' && !isEditing && (
                <Button variant="outline" size="icon" onClick={handleBack} className="shrink-0 h-8 w-8 rounded-full border-muted-foreground/20">
                  <ChevronLeft className="h-4 w-4 text-muted-foreground" />
                </Button>
              )}
              
              <div className="flex-1 min-w-0">
                <SheetTitle className={cn("text-xl truncate", isEditing && "sr-only")}>
                  {view === 'dashboard' && f?.full_name}
                  {view === 'profile' && "Core Profile"}
                  {view === 'fspp' && "FSPP Evaluation"}
                  {view === 'farm_cards' && "Farm Cards Directory"}
                  {view === 'farm_card_detail' && `Plot: ${selectedFarmCard?.card_data?.fieldNumber || 'Farm Card'}`}
                </SheetTitle>
                
                {!isEditing && view === 'dashboard' && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                    <span>{f?.village || 'No village'}</span>
                    <span>· Onboarded by {f?.profiles?.name || 'N/A'}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col items-end gap-2 shrink-0">
              {view === 'dashboard' && <Badge>{f?.status || 'DRAFT'}</Badge>}
              
              <div className="flex gap-2 justify-end">
                {isEditing && view === 'profile' ? (
                  <>
                    <Button size="sm" variant="outline" onClick={() => setIsEditing(false)} disabled={saving} className="gap-1">
                      <X className="h-3.5 w-3.5" /> Cancel
                    </Button>
                    <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1">
                      {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save
                    </Button>
                  </>
                ) : (
                  view === 'profile' && hasEditAccess && (
                    <Button size="sm" onClick={() => setIsEditing(true)} className="gap-1">
                      <Edit className="h-3.5 w-3.5" /> Edit
                    </Button>
                  )
                )}
              </div>
            </div>

          </div>
        </SheetHeader>

        {/* 🚀 MAIN CONTENT AREA */}
        <ScrollArea className="flex-1">
          
          {/* ============================================================== */}
          {/* VIEW: DASHBOARD (The 3 Clickable Hub Cards) */}
          {/* ============================================================== */}
          {view === 'dashboard' && (
            <div className="p-6 space-y-4">
              <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-2">
                <LayoutDashboard className="h-4 w-4" /> Farmer Dashboard
              </h3>

              <div className="grid grid-cols-1 gap-4">
                {/* 1. Core Profile Card */}
                <div onClick={() => setView('profile')} className="group bg-white border rounded-xl p-5 shadow-sm cursor-pointer hover:border-primary hover:shadow-md transition-all flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                      <User className="h-6 w-6" />
                    </div>
                    <div>
                      <h4 className="text-lg font-bold text-foreground">Core Profile & History</h4>
                      <p className="text-sm text-muted-foreground">Personal, land, and crop history.</p>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>

                {/* 2. FSPP Evaluation Card */}
                <div 
                  onClick={() => hasFspp && setView('fspp')} 
                  className={cn("group bg-white border rounded-xl p-5 shadow-sm transition-all flex items-center justify-between", hasFspp ? "cursor-pointer hover:border-green-500 hover:shadow-md" : "opacity-70 grayscale")}
                >
                  <div className="flex items-center gap-4">
                    <div className={cn("h-12 w-12 rounded-full flex items-center justify-center transition-colors", hasFspp ? "bg-green-100 text-green-700 group-hover:bg-green-600 group-hover:text-white" : "bg-muted text-muted-foreground")}>
                      <ClipboardCheck className="h-6 w-6" />
                    </div>
                    <div>
                      <h4 className="text-lg font-bold text-foreground">FSPP Evaluation</h4>
                      {hasFspp ? (
                        <p className="text-sm font-medium text-green-600">{fspp.category || 'Evaluated'} • Score: {fspp.score}</p>
                      ) : (
                        <p className="text-sm text-muted-foreground italic">Not evaluated yet.</p>
                      )}
                    </div>
                  </div>
                  {hasFspp && <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-green-600 transition-colors" />}
                </div>

                {/* 3. Farm Cards Directory */}
                <div 
                  onClick={() => farmCards.length > 0 && setView('farm_cards')} 
                  className={cn("group bg-white border rounded-xl p-5 shadow-sm transition-all flex items-center justify-between", farmCards.length > 0 ? "cursor-pointer hover:border-amber-500 hover:shadow-md" : "opacity-70 grayscale")}
                >
                  <div className="flex items-center gap-4">
                    <div className={cn("h-12 w-12 rounded-full flex items-center justify-center transition-colors", farmCards.length > 0 ? "bg-amber-100 text-amber-700 group-hover:bg-amber-600 group-hover:text-white" : "bg-muted text-muted-foreground")}>
                      <MapIcon className="h-6 w-6" />
                    </div>
                    <div>
                      <h4 className="text-lg font-bold text-foreground">Farm Cards (Plots)</h4>
                      {farmCards.length > 0 ? (
                        <p className="text-sm font-medium text-amber-600">{farmCards.length} Registered Plot{farmCards.length > 1 ? 's' : ''}</p>
                      ) : (
                        <p className="text-sm text-muted-foreground italic">No plots registered.</p>
                      )}
                    </div>
                  </div>
                  {farmCards.length > 0 && <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-amber-600 transition-colors" />}
                </div>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* VIEW: FSPP DETAILS */}
          {/* ============================================================== */}
          {view === 'fspp' && hasFspp && (
            <div className="p-6 space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              
              <div className="bg-white border rounded-xl p-6 shadow-sm flex flex-col sm:flex-row items-center gap-6">
                <div className="h-24 w-24 rounded-full border-4 border-green-500 flex flex-col items-center justify-center shrink-0">
                  <span className="text-2xl font-black text-green-700">{fspp.score}</span>
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">Score</span>
                </div>
                <div className="text-center sm:text-left">
                  <h3 className="text-2xl font-bold text-foreground mb-1">{fspp.category || 'N/A'}</h3>
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">{fspp.statusLabel || 'Qualified'}</Badge>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white p-4 rounded-xl border shadow-sm">
                  <p className="text-xs font-bold text-muted-foreground uppercase mb-1">Committed Land</p>
                  <p className="text-xl font-black text-amber-700">{fspp.committedLand || '0'} <span className="text-sm font-normal text-muted-foreground">{fspp.committedLandUnit || 'Acres'}</span></p>
                </div>
                <div className="bg-white p-4 rounded-xl border shadow-sm">
                  <p className="text-xs font-bold text-muted-foreground uppercase mb-1">Total Land</p>
                  <p className="text-xl font-black">{fspp.totalLand || '0'} <span className="text-sm font-normal text-muted-foreground">Acres</span></p>
                </div>
              </div>

              <Section title="Evaluation Metrics">
                <KeyValueGrid data={{
                  "Mindset A (Innovator)": `${fspp.mindsetA} pts`,
                  "Mindset B (Investment)": `${fspp.mindsetB} pts`,
                  "MindsetC (Sustainability)": `${fspp.mindsetC} pts`,
                  "Mindset D (Compliance)": `${fspp.mindsetD} pts`,
                  "Biofertilizer Awareness": `${fspp.bioAwareness} pts`,
                  "GLS Knowledge": `${fspp.glsKnowledge} pts`,
                  "Seasonal Expense": `₹ ${fspp.seasonalExpense}`,
                  "Evaluation Date": new Date(fspp.evaluationDate).toLocaleDateString()
                }} />
              </Section>
            </div>
          )}

          {/* ============================================================== */}
          {/* VIEW: FARM CARDS DIRECTORY */}
          {/* ============================================================== */}
          {view === 'farm_cards' && (
            <div className="p-6 space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
              {farmCards.map(fc => {
                const data = fc.card_data || {};
                const status = (fc.status || 'DRAFT').toUpperCase();
                const isDraft = status === 'DRAFT';

                return (
                  <div 
                    key={fc.id} 
                    onClick={() => { setSelectedFarmCard(fc); setView('farm_card_detail'); }}
                    // 🚀 DYNAMIC ENTIRE CARD STYLING
                    className={cn(
                      "border rounded-xl p-4 shadow-sm cursor-pointer hover:shadow-md transition-all group",
                      isDraft 
                        ? "bg-orange-50/50 border-orange-200 hover:border-orange-400" 
                        : "bg-green-50/50 border-green-200 hover:border-green-400"
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        {/* 🚀 DYNAMIC ICON COLOR */}
                        <div className={cn(
                          "h-10 w-10 rounded-lg flex items-center justify-center transition-colors",
                          isDraft 
                            ? "bg-orange-100 text-orange-700 group-hover:bg-orange-600 group-hover:text-white" 
                            : "bg-green-100 text-green-700 group-hover:bg-green-600 group-hover:text-white"
                        )}>
                          <Leaf className="h-5 w-5" />
                        </div>
                        
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-foreground">Plot: {data.fieldNumber || 'Unnamed'}</h4>
                            <Badge className={cn(
                              "text-[9px] px-1.5 py-0 uppercase tracking-wider",
                              isDraft 
                                ? "bg-orange-100 text-orange-800 hover:bg-orange-100 border-orange-200" 
                                : "bg-green-100 text-green-800 hover:bg-green-100 border-green-200"
                            )}>
                              {status}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{data.village || f.village}, {data.taluka || f.personal_details?.taluka}</p>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <Badge variant="outline" className={cn("bg-white", isDraft ? "border-orange-200 text-orange-800" : "border-green-200 text-green-800")}>
                          {data.cultivatedArea || data.totalLandArea || 0} {data.cultivatedAreaUnit || 'Acres'}
                        </Badge>
                        <ChevronRight className={cn(
                          "h-4 w-4 mt-2 ml-auto transition-colors",
                          isDraft ? "text-orange-400 group-hover:text-orange-600" : "text-green-400 group-hover:text-green-600"
                        )} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ============================================================== */}
          {/* VIEW: FARM CARD SPECIFIC DETAILS */}
          {/* ============================================================== */}
          {view === 'farm_card_detail' && selectedFarmCard && (
            <div className="p-6 space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              
              <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
                {/* 🚀 DYNAMIC STATUS BADGE (Detail View) */}
                <Badge className={cn(
                  (selectedFarmCard.status || 'DRAFT').toUpperCase() === 'DRAFT'
                    ? "bg-orange-100 text-orange-800 hover:bg-orange-100 border-orange-200"
                    : "bg-green-100 text-green-800 hover:bg-green-100 border-green-200"
                )}>
                  {(selectedFarmCard.status || 'DRAFT').toUpperCase()}
                </Badge>
                
                <Badge variant="outline">
                  Created: {new Date(selectedFarmCard.created_at).toLocaleDateString()}
                </Badge>
              </div>

              {/* Just loop through the massive farm card json dynamically! */}
              <Section title="Plot Geography">
                <KeyValueGrid data={{
                  "State": selectedFarmCard.card_data.state,
                  "District": selectedFarmCard.card_data.district,
                  "Taluka": selectedFarmCard.card_data.taluka,
                  "Village": selectedFarmCard.card_data.village,
                  "Survey No": selectedFarmCard.card_data.surveyNo,
                  "Land Status": selectedFarmCard.card_data.landStatus,
                  "Cultivated Area": `${selectedFarmCard.card_data.cultivatedArea} ${selectedFarmCard.card_data.cultivatedAreaUnit}`,
                }} />
              </Section>

              <Section title="Soil & Water Metrics">
                <KeyValueGrid data={{
                  "Soil Type": selectedFarmCard.card_data.soilType,
                  "Soil pH": selectedFarmCard.card_data.soilPh,
                  "Soil EC": selectedFarmCard.card_data.soilEc,
                  "Organic Matter": selectedFarmCard.card_data.organicMatter,
                  "Water Source": selectedFarmCard.card_data.waterSource,
                  "Water pH": selectedFarmCard.card_data.waterPh,
                  "Water TDS": selectedFarmCard.card_data.waterTds,
                  "Irrigation Method": selectedFarmCard.card_data.irrigationMethod,
                  "Drip Area": `${selectedFarmCard.card_data.dripArea} ${selectedFarmCard.card_data.dripAreaUnit}`,
                  "Pump HP": selectedFarmCard.card_data.pumpHp,
                }} />
              </Section>

              <Section title="Livestock & Assets">
                <KeyValueGrid data={{
                  "Milch Cows": selectedFarmCard.card_data.milchCows,
                  "Buffaloes": selectedFarmCard.card_data.buffaloes,
                  "Draft Animals": selectedFarmCard.card_data.draftAnimals,
                  "Goats/Sheep/Poultry": selectedFarmCard.card_data.goatsSheepPoultry,
                  "FYM Generated": selectedFarmCard.card_data.fymGenerated,
                  "Labour Type": selectedFarmCard.card_data.labourType,
                }} />
              </Section>

              <Section title="Yield History">
                {selectedFarmCard.card_data.yieldHistory && selectedFarmCard.card_data.yieldHistory.length > 0 ? (
                  <div className="rounded-md border border-border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-white">
                          <TableHead className="font-semibold text-xs whitespace-nowrap">Year</TableHead>
                          <TableHead className="font-semibold text-xs whitespace-nowrap">Season</TableHead>
                          <TableHead className="font-semibold text-xs whitespace-nowrap">Crop</TableHead>
                          <TableHead className="font-semibold text-xs whitespace-nowrap">Area</TableHead>
                          <TableHead className="font-semibold text-xs whitespace-nowrap">Yield</TableHead>
                          <TableHead className="font-semibold text-xs whitespace-nowrap">Price/Qtl</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedFarmCard.card_data.yieldHistory.map((yh: any, i: number) => (
                          <TableRow key={i} className="bg-white">
                            <TableCell className="text-xs">{yh.year}</TableCell>
                            <TableCell className="text-xs">{yh.season}</TableCell>
                            <TableCell className="text-xs font-medium">{yh.cropGrown}</TableCell>
                            <TableCell className="text-xs">{yh.area} {yh.areaUnit}</TableCell>
                            <TableCell className="text-xs">{yh.yieldQtl}</TableCell>
                            <TableCell className="text-xs">₹ {yh.priceQtl}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">No yield history available.</p>
                )}
              </Section>

              <Section title="Media & Attachments">
                {selectedFarmCard.media_urls && Object.keys(selectedFarmCard.media_urls).length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Object.entries(selectedFarmCard.media_urls).map(([key, rawUrl]) => {
                      const url = String(rawUrl);
                      // Auto-detect videos vs images based on extension
                      const isVideo = url.match(/\.(mp4|mov|webm)$/i);
                      const displayName = key.replace(/_/g, ' ').toUpperCase();

                      return (
                        <div key={key} className="flex flex-col p-2 border rounded-xl bg-white shadow-sm hover:shadow-md transition-all">
                          <span className="text-xs font-bold text-muted-foreground mb-2 px-1">{displayName}</span>
                          <div className="relative aspect-video bg-muted rounded-lg overflow-hidden border border-border/50 group">
                            {isVideo ? (
                              <video 
                                src={url} 
                                controls 
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  // Fallback for local/broken links
                                  e.currentTarget.style.display = 'none';
                                  e.currentTarget.parentElement!.innerHTML = '<div class="w-full h-full flex flex-col items-center justify-center text-xs text-muted-foreground p-4 text-center">Video not available<br/>(Local paths blocked)</div>';
                                }}
                              />
                            ) : (
                              <img 
                                src={url} 
                                alt={displayName} 
                                className="w-full h-full object-cover" 
                                onError={(e) => {
                                  // 🚀 Fallback placeholder so it looks nice until Cloudinary is wired up!
                                  e.currentTarget.src = `https://placehold.co/600x400/f8fafc/94a3b8?text=Image+Not+Available%0A(Local+Device+Path)`;
                                }}
                              />
                            )}
                          </div>
                          <Button asChild variant="secondary" size="sm" className="w-full mt-2 text-[10px] h-7">
                            <a href={url} target="_blank" rel="noreferrer">Open Full File</a>
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">No media attachments found for this plot.</p>
                )}
              </Section>

            </div>
          )}

          {/* ============================================================== */}
          {/* VIEW: ORIGINAL PROFILE (The original exact Tabs content!) */}
          {/* ============================================================== */}
          {view === 'profile' && (
            <Tabs defaultValue="personal" className="flex flex-col min-h-0 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="bg-white px-6 pt-4 border-b">
                <TabsList className="grid grid-cols-3 w-full sm:w-auto sm:max-w-md bg-muted/50">
                  <TabsTrigger value="personal">1. Personal</TabsTrigger>
                  <TabsTrigger value="farm">2. Farm Details</TabsTrigger>
                  <TabsTrigger value="history">3. History</TabsTrigger>
                </TabsList>
              </div>
              
              <div className="px-6 py-6 space-y-8">
                
                <TabsContent value="personal" className="space-y-4 mt-0">
                  <Section title="Personal Information">
                    {isEditing ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5"><Label>Father's Name *</Label><Input value={pd.fatherName} onChange={e => updatePd('fatherName', e.target.value)} /></div>
                        <div className="space-y-1.5"><Label>Mobile Number *</Label><Input value={mobile} maxLength={10} type="tel" onChange={e => setMobile(e.target.value)} /></div>
                        <div className="space-y-1.5"><Label>Alternate Mobile</Label><Input value={pd.alternateMobile} maxLength={10} type="tel" onChange={e => updatePd('alternateMobile', e.target.value)} /></div>
                        <div className="space-y-1.5"><Label>State *</Label><SearchableSingleSelect label="State" options={INDIAN_STATES} value={pd.state} onChange={v => setPd(p => ({ ...p, state: v }))} placeholder="Select State" /></div>
                        <div className="space-y-1.5"><Label>District *</Label><SearchableSingleSelect label="District" options={dbDistricts.map(d => d.name)} value={pd.city} onChange={v => { updatePd('city', v); updatePd('taluka', ''); setVillage(''); }} placeholder="Select District" /></div>
                        <div className="space-y-1.5"><Label>Taluka *</Label><SearchableSingleSelect label="Taluka" options={dbTalukas.map(t => t.name)} value={pd.taluka} onChange={v => { updatePd('taluka', v); setVillage(''); }} placeholder="Select Taluka" /></div>
                        <div className="space-y-1.5"><Label>Pincode</Label><Input value={pd.pincode} maxLength={6} type="tel" onChange={e => updatePd('pincode', e.target.value)} /></div>
                      </div>
                    ) : (
                      <KeyValueGrid data={{ 'Mobile': f?.mobile, ...(f?.personal_details || {}) }} />
                    )}
                  </Section>
                </TabsContent>

                <TabsContent value="farm" className="space-y-4 mt-0">
                  <Section title="Land & Crops">
                    {isEditing ? (
                      <div className="space-y-4">
                        <div className="grid grid-cols-3 gap-3">
                          <div className="space-y-1.5"><Label>Total Land *</Label><Input type="number" value={fd.totalLand} onChange={e => updateFd('totalLand', e.target.value)} /></div>
                          <div className="space-y-1.5"><Label>Irrigated Land</Label><Input type="number" value={fd.irrigatedLand} onChange={e => updateFd('irrigatedLand', e.target.value)} /></div>
                          <div className="space-y-1.5"><Label>Rain-Fed Land</Label><Input type="number" value={fd.rainFedLand} onChange={e => updateFd('rainFedLand', e.target.value)} /></div>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                          <div className="space-y-1.5"><Label>Land Unit</Label><Select value={fd.landUnit} onValueChange={v => updateFd('landUnit', v)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{LAND_UNITS.map(unit => <SelectItem key={unit} value={unit}>{unit}</SelectItem>)}</SelectContent></Select></div>
                          <div className="space-y-1.5"><Label>Intercropping?</Label><Select value={fd.isIntercropping} onValueChange={v => updateFd('isIntercropping', v)}><SelectTrigger><SelectValue placeholder="Select..."/></SelectTrigger><SelectContent><SelectItem value="Yes">Yes</SelectItem><SelectItem value="No">No</SelectItem></SelectContent></Select></div>
                          <div className="space-y-1.5 sm:col-span-2"><Label>Biofertilizer Knowledge</Label><Select value={fd.biofertilizer} onValueChange={v => updateFd('biofertilizer', v)}><SelectTrigger><SelectValue placeholder="Select..."/></SelectTrigger><SelectContent>{BIOFERTILIZER_OPTS.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}</SelectContent></Select></div>
                          <div className="space-y-1.5 flex flex-col"><Label className="font-semibold">Major Crops *</Label><SearchableMultiSelect label="Crops" options={WEST_INDIA_CROPS} selected={fd.majorCrops} onChange={v => updateFd('majorCrops', v)} /></div>
                          <div className="space-y-1.5 flex flex-col"><Label className="font-semibold">Soil Type *</Label><SearchableMultiSelect label="Soil" options={SOIL_TYPES} selected={fd.soilType} onChange={v => updateFd('soilType', v)} /></div>
                          {fd.soilType.includes('Others') && <div className="space-y-1.5 sm:col-span-2"><Label>Specify Other Soil Type *</Label><Input value={fd.otherSoilType} onChange={e => updateFd('otherSoilType', e.target.value)} /></div>}
                          <div className="space-y-1.5 flex flex-col"><Label className="font-semibold">Water Source *</Label><SearchableMultiSelect label="Source" options={WATER_SOURCES} selected={fd.waterSource} onChange={v => updateFd('waterSource', v)} /></div>
                          {fd.waterSource.includes('Others') && <div className="space-y-1.5 sm:col-span-2"><Label>Specify Other Water Source *</Label><Input value={fd.otherWaterSource} onChange={e => updateFd('otherWaterSource', e.target.value)} /></div>}
                          <div className="space-y-1.5 flex flex-col"><Label className="font-semibold">Irrigation Types</Label><SearchableMultiSelect label="Type" options={IRRIGATION_TYPES} selected={fd.irrigationType} onChange={v => updateFd('irrigationType', v)} /></div>
                          <div className="space-y-1.5 flex flex-col sm:col-span-2"><Label className="font-semibold">Farm Equipments</Label><SearchableMultiSelect label="Equipment" options={FARM_EQUIPMENTS} selected={fd.farmEquipments} onChange={v => updateFd('farmEquipments', v)} /></div>
                          {fd.farmEquipments.includes('Others') && <div className="space-y-1.5 sm:col-span-2"><Label>Specify Other Equipment *</Label><Input value={fd.otherFarmEquipment} onChange={e => updateFd('otherFarmEquipment', e.target.value)} /></div>}
                        </div>
                      </div>
                    ) : (
                      <>
                        <KeyValueGrid data={farmRest} />
                        {arrayFields.map(([k, vals]) => (
                          <div key={k} className="mt-4">
                            <Label className="text-sm font-semibold mb-2 block">{fmtKey(k)}</Label>
                            <div className="flex flex-wrap gap-1.5">{vals.map((v, i) => <Badge key={i} variant="secondary">{String(v)}</Badge>)}</div>
                          </div>
                        ))}
                      </>
                    )}
                  </Section>
                  
                  <Section title="Side Trees">
                    {isEditing ? (
                      <div className="space-y-2">
                        {sideTrees.map((tree, i) => (
                          <div key={i} className="flex gap-2 items-center bg-background border border-border rounded-md p-1.5">
                            <Select value={tree.type} onValueChange={e => updateArr(setSideTrees, i, 'type', e)}><SelectTrigger className="h-8 flex-1 border-0 focus:ring-0 shadow-none"><SelectValue placeholder="Select Tree" /></SelectTrigger><SelectContent>{TREE_TYPES.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}</SelectContent></Select>
                            <Input placeholder="Qty" type="number" value={tree.quantity} onChange={e => updateArr(setSideTrees, i, 'quantity', e.target.value)} className="w-24 h-8" />
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive shrink-0" onClick={() => removeArr(setSideTrees, i)}><Trash2 className="h-4 w-4"/></Button>
                          </div>
                        ))}
                        <Button variant="outline" size="sm" className="w-full border-dashed" onClick={() => setSideTrees(p => [...p, {type:'', quantity:''}])}><Plus className="h-4 w-4 mr-2"/> Add Tree</Button>
                      </div>
                    ) : (
                      <KeyValueGrid data={farmData.sideTrees ? Object.fromEntries(farmData.sideTrees.map((t:any, i:number) => [`Tree ${i+1} (${t.type})`, t.quantity])) : {}} />
                    )}
                  </Section>

                  <Section title="Cattles / Livestock">
                    {isEditing ? (
                      <div className="space-y-2">
                        {cattles.map((cattle, i) => (
                          <div key={i} className="flex gap-2 items-center bg-background border border-border rounded-md p-1.5">
                            <Select value={cattle.type} onValueChange={e => updateArr(setCattles, i, 'type', e)}><SelectTrigger className="h-8 flex-1 border-0 focus:ring-0 shadow-none"><SelectValue placeholder="Select Livestock" /></SelectTrigger><SelectContent>{CATTLE_TYPES.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}</SelectContent></Select>
                            <Input placeholder="Qty" type="number" value={cattle.quantity} onChange={e => updateArr(setCattles, i, 'quantity', e.target.value)} className="w-24 h-8" />
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive shrink-0" onClick={() => removeArr(setCattles, i)}><Trash2 className="h-4 w-4"/></Button>
                          </div>
                        ))}
                        <Button variant="outline" size="sm" className="w-full border-dashed" onClick={() => setCattles(p => [...p, {type:'', quantity:''}])}><Plus className="h-4 w-4 mr-2"/> Add Cattle</Button>
                      </div>
                    ) : (
                      <KeyValueGrid data={farmData.cattles ? Object.fromEntries(farmData.cattles.map((t:any, i:number) => [`Cattle ${i+1} (${t.type})`, t.quantity])) : {}} />
                    )}
                  </Section>
                </TabsContent>

                <TabsContent value="history" className="space-y-4 mt-0">
                  <Section title="Cultivation History">
                    {isEditing ? (
                      <div className="space-y-4">
                        {pastCrops.map((crop, i) => (
                          <div key={i} className="p-3 bg-muted/20 border border-border rounded-md relative space-y-3">
                            <div className="flex justify-between items-center mb-1"><Label className="font-bold text-primary">Crop Record {i + 1}</Label><Button variant="ghost" size="icon" className="text-destructive h-6 w-6" onClick={() => removeArr(setPastCrops, i)}><Trash2 className="h-4 w-4"/></Button></div>
                            <div className="space-y-1.5"><Label className="text-xs">Crop Name</Label><Select value={crop.cropName} onValueChange={e => updateArr(setPastCrops, i, 'cropName', e)}><SelectTrigger className="bg-background"><SelectValue placeholder="Select Crop Name" /></SelectTrigger><SelectContent>{WEST_INDIA_CROPS.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}</SelectContent></Select></div>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1"><Label className="text-[10px]">Area</Label><Input type="number" value={crop.area} onChange={e => updateArr(setPastCrops, i, 'area', e.target.value)} className="h-8" /></div>
                              <div className="space-y-1"><Label className="text-[10px]">Area Unit</Label><Select value={crop.areaUnit} onValueChange={e => updateArr(setPastCrops, i, 'areaUnit', e)}><SelectTrigger className="h-8 bg-background"><SelectValue /></SelectTrigger><SelectContent>{LAND_UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent></Select></div>
                              <div className="space-y-1"><Label className="text-[10px]">Yield Obtained</Label><Input type="number" value={crop.yield} onChange={e => updateArr(setPastCrops, i, 'yield', e.target.value)} className="h-8" /></div>
                              <div className="space-y-1"><Label className="text-[10px]">Yield Unit</Label><Select value={crop.yieldUnit} onValueChange={e => updateArr(setPastCrops, i, 'yieldUnit', e)}><SelectTrigger className="h-8 bg-background"><SelectValue /></SelectTrigger><SelectContent>{YIELD_UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent></Select></div>
                              <div className="space-y-1 flex flex-col col-span-2"><Label className="text-[10px] font-semibold">Inputs Used</Label><SearchableMultiSelect label="Inputs" options={INPUTS_USED} selected={crop.inputUsed} onChange={v => updateArr(setPastCrops, i, 'inputUsed', v)} /></div>
                              {crop.inputUsed.includes('Others') && <div className="space-y-1 col-span-2"><Label className="text-[10px]">Specify Other Input</Label><Input value={crop.otherInputUsed} onChange={e => updateArr(setPastCrops, i, 'otherInputUsed', e.target.value)} className="h-8" /></div>}
                              <div className="space-y-1 col-span-2"><Label className="text-[10px]">Problems Faced</Label><Input placeholder="e.g., Low rain, Pests" value={crop.problemsFaced} onChange={e => updateArr(setPastCrops, i, 'problemsFaced', e.target.value)} className="h-8" /></div>
                            </div>
                          </div>
                        ))}
                        <Button variant="outline" size="sm" className="w-full border-dashed" onClick={() => setPastCrops(p => [...p, {cropName:'', area:'', areaUnit:'Acres', inputUsed:[], otherInputUsed:'', yield:'', yieldUnit:'Quintals', problemsFaced:''}])}><Plus className="h-4 w-4 mr-2" /> Add Past Crop Record</Button>
                      </div>
                    ) : (
                      <>
                        {viewPastCrops.length === 0 ? <p className="text-sm text-muted-foreground italic mb-4">No history recorded</p> : pastCropKeys.length > 0 ? (
                          <div className="rounded-md border border-border overflow-x-auto mb-4">
                            <Table>
                              <TableHeader><TableRow className="bg-muted/50">{pastCropKeys.map(k => <TableHead key={k} className="font-semibold whitespace-nowrap">{fmtKey(k)}</TableHead>)}</TableRow></TableHeader>
                              <TableBody>
                                {viewPastCrops.map((row, i) => (
                                  <TableRow key={i}>
                                    {pastCropKeys.map(k => <TableCell key={k} className="text-sm">{row?.[k] != null ? (Array.isArray(row[k]) ? row[k].join(', ') : String(row[k])) : '—'}</TableCell>)}
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        ) : <div className="flex flex-wrap gap-1.5 mb-4">{viewPastCrops.map((c, i) => <Badge key={i} variant="secondary">{String(c)}</Badge>)}</div>}
                      </>
                    )}
                  </Section>
                </TabsContent>

              </div>
            </Tabs>
          )}

        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};

export default FarmerDetailSheet;