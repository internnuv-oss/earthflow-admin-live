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
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileText, Edit, Save, X, Loader2, Plus, Trash2, Check, ChevronsUpDown } from 'lucide-react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { KeyValueGrid, Section, fmtKey } from '@/lib/jsonViewer';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { FarmerRow } from './FarmerTable';

// --- MOBILE APP SELECTION CONSTANTS ---
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

// --- SEARCHABLE MULTI-SELECT DROPDOWN COMPONENT ---
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
                  <CommandItem
                    key={opt}
                    value={opt}
                    onSelect={() => {
                      if (isSelected) onChange(selected.filter(x => x !== opt));
                      else onChange([...selected, opt]);
                    }}
                  >
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

// --- SEARCHABLE SINGLE SELECT DROPDOWN COMPONENT ---
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
                <CommandItem
                  key={opt}
                  value={opt}
                  onSelect={() => {
                    onChange(opt);
                    setOpen(false);
                  }}
                >
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
}

const safeArray = (val: any): string[] => {
  if (Array.isArray(val)) return val.map(String);
  if (typeof val === 'string' && val) return val.split(',').map(s => s.trim()).filter(Boolean);
  return [];
};

const FarmerDetailSheet = ({ farmer: f, open, onClose, onSaved }: Props) => {
  const { toast } = useToast();
  
  // --- EDIT STATE ---
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Top Level
  const [fullName, setFullName] = useState('');
  const [mobile, setMobile] = useState('');
  const [village, setVillage] = useState('');
  
  // Personal Details
  const [pd, setPd] = useState({ fatherName: '', alternateMobile: '', state: '', city: '', taluka: '', pincode: '' });
  
  // Farm Details
  const [fd, setFd] = useState({
    totalLand: '', landUnit: 'Acres', irrigatedLand: '', rainFedLand: '',
    majorCrops: [] as string[], soilType: [] as string[], otherSoilType: '', 
    waterSource: [] as string[], otherWaterSource: '',
    irrigationType: [] as string[], farmEquipments: [] as string[], otherFarmEquipment: '', 
    biofertilizer: '', isIntercropping: ''
  });
  
  // Arrays
  const [sideTrees, setSideTrees] = useState<{type: string, quantity: string}[]>([]);
  const [cattles, setCattles] = useState<{type: string, quantity: string}[]>([]);
  const [pastCrops, setPastCrops] = useState<{cropName: string, area: string, areaUnit: string, inputUsed: string[], otherInputUsed: string, yield: string, yieldUnit: string, problemsFaced: string}[]>([]);

  // Cascading Location Cascade States
  const [stateData, setStateData] = useState<any>(null);
  const [cities, setCities] = useState<string[]>([]);
  const [talukas, setTalukas] = useState<string[]>([]);
  const [loadingLoc, setLoadingLoc] = useState(false);

  // Load cascading datasets based on chosen State
  useEffect(() => {
    if (!pd.state || !isEditing) { setStateData(null); setCities([]); return; }
    const fetchStateData = async () => {
      setLoadingLoc(true);
      try {
        const res = await fetch(`https://raw.githubusercontent.com/internnuv-oss/indian-cities-and-villages/master/By%20States/${encodeURIComponent(pd.state)}.json`);
        if (!res.ok) throw new Error("State location catalog not found.");
        setStateData(await res.json());
      } catch (e) {
        setCities([]); setStateData(null);
      } finally { setLoadingLoc(false); }
    };
    fetchStateData();
  }, [pd.state, isEditing]);

  useEffect(() => {
    if (!stateData || !stateData.districts) return setCities([]);
    setCities(stateData.districts.map((d: any) => d.district).sort());
  }, [stateData]);

  useEffect(() => {
    if (!pd.city || !stateData || !stateData.districts) return setTalukas([]);
    const dist = stateData.districts.find((d: any) => d.district === pd.city);
    if (dist && dist.subDistricts) setTalukas(dist.subDistricts.map((sd: any) => sd.subDistrict).sort());
    else setTalukas([]);
  }, [pd.city, stateData]);

  // Load Data
  useEffect(() => {
    if (f && open) {
      setFullName(f.full_name || '');
      setMobile(f.mobile || '');
      setVillage(f.village || '');
      
      const p = f.personal_details || {};
      setPd({
        fatherName: p.fatherName || '', alternateMobile: p.alternateMobile || '',
        state: p.state || '', city: p.city || '', taluka: p.taluka || '', pincode: p.pincode || ''
      });

      const farm = f.farm_details || {};
      setFd({
        totalLand: farm.totalLand || '', landUnit: farm.landUnit || 'Acres',
        irrigatedLand: farm.irrigatedLand || '', rainFedLand: farm.rainFedLand || '',
        majorCrops: safeArray(farm.majorCrops),
        soilType: safeArray(farm.soilType),
        otherSoilType: farm.otherSoilType || '',
        waterSource: safeArray(farm.waterSource),
        otherWaterSource: farm.otherWaterSource || '',
        irrigationType: safeArray(farm.irrigationType),
        farmEquipments: safeArray(farm.farmEquipments),
        otherFarmEquipment: farm.otherFarmEquipment || '',
        biofertilizer: farm.biofertilizer || '',
        isIntercropping: farm.isIntercropping || ''
      });

      setSideTrees(Array.isArray(farm.sideTrees) ? farm.sideTrees : []);
      setCattles(Array.isArray(farm.cattles) ? farm.cattles : []);
      
      const history = f.history_details || {};
      const crops = Array.isArray(history.pastCrops) ? history.pastCrops : [];
      setPastCrops(crops.map(c => ({
        ...c,
        inputUsed: safeArray(c.inputUsed)
      })));
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
    if (validationError) {
      toast({ title: "Validation Error", description: validationError, variant: "destructive" });
      return;
    }

    setSaving(true);

    const personal_details = { ...f.personal_details, ...pd };
    const farm_details = { ...f.farm_details, ...fd, sideTrees, cattles };
    const history_details = { ...f.history_details, pastCrops };

    const historyEntry = { timestamp: new Date().toISOString(), action: 'Admin Edited Profile', updated_status: f.status };
    const update_history = [...(f.update_history || []), historyEntry];

    if (f.status === 'DRAFT') {
      const draft_data = {
        fullName, mobile, village,
        ...pd,
        ...fd,
        sideTrees, cattles,
        pastCrops
      };

      const { error } = await (supabase as any)
        .from('drafts')
        .update({ draft_data, updated_at: new Date().toISOString(), update_history })
        .or(`id.eq.${f.id},entity_id.eq.${f.id}`);

      setSaving(false);
      if (error) return toast({ title: 'Failed to save draft', description: error.message, variant: 'destructive' });
      toast({ title: 'Success', description: 'Farmer Draft updated successfully.' });
      setIsEditing(false);
      if (onSaved) onSaved(); 
      onClose();
      return;
    }

    const { error } = await (supabase as any)
      .from('farmers')
      .update({
        full_name: fullName, 
        mobile, 
        village,
        personal_details, 
        farm_details, 
        history_details,
        update_history
      })
      .eq('id', f.id);

    setSaving(false);

    if (error) {
      toast({ title: 'Failed to save', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Farmer details updated successfully.' });
      setIsEditing(false);
      if (onSaved) onSaved(); 
      onClose();
    }
  };

  // State Updaters
  const updatePd = (k: string, v: string) => setPd(p => ({ ...p, [k]: v }));
  const updateFd = (k: string, v: any) => setFd(p => ({ ...p, [k]: v }));
  const updateArr = (setter: any, idx: number, key: string, val: any) => setter((prev: any) => prev.map((item: any, i: number) => i === idx ? { ...item, [key]: val } : item));
  const removeArr = (setter: any, idx: number) => setter((prev: any) => prev.filter((_: any, i: number) => i !== idx));

  if (!f) return null;

  // View Mode Variables
  const farmData = f?.farm_details || {};
  const farmRest: Record<string, unknown> = {};
  const arrayFields: Array<[string, any[]]> = [];
  for (const [k, v] of Object.entries(farmData)) {
    if (k !== 'sideTrees' && k !== 'cattles') {
      if (Array.isArray(v) && v.every(x => typeof x === 'string' || typeof x === 'number')) {
        arrayFields.push([k, v]);
      } else {
        farmRest[k] = v;
      }
    }
  }
  const viewPastCrops: any[] = (f?.history_details as any)?.pastCrops || [];
  const pastCropKeys = viewPastCrops.length > 0 && typeof viewPastCrops[0] === 'object'
    ? Array.from(new Set(viewPastCrops.flatMap(c => Object.keys(c || {}))))
    : [];

  return (
    <Sheet open={open} onOpenChange={o => { if (!o) { setIsEditing(false); onClose(); } }}>
      <SheetContent side="right" className="w-full sm:max-w-2xl lg:max-w-3xl p-0 flex flex-col">
        <SheetHeader className="px-6 py-5 border-b border-border space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              {isEditing ? (
                <div className="space-y-1 mb-2">
                  <Label className="text-xs text-muted-foreground">Full Name *</Label>
                  <Input value={fullName} onChange={e => setFullName(e.target.value)} className="text-lg font-bold h-9 w-full max-w-sm" />
                </div>
              ) : (
                <>
                  <SheetTitle className="text-xl truncate">{f?.full_name || 'Farmer'}</SheetTitle>
                  <SheetDescription className="sr-only">Farmer configuration panel.</SheetDescription> 
                </>
              )}
              
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                {isEditing ? (
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground">Village *:</span>
                    <Input value={village} onChange={e => setVillage(e.target.value)} className="h-7 w-32 text-xs" />
                  </div>
                ) : (
                  <span>{f?.village || 'No village'}</span>
                )}
                <span>· Onboarded by {f?.profiles?.name || 'N/A'}</span>
              </div>
            </div>

            <div className="flex flex-col items-end gap-2 shrink-0">
              <Badge>{f?.status || 'DRAFT'}</Badge>

              {!isEditing && (
                <Button size="sm" variant="outline" className="h-8" onClick={() => setIsEditing(true)}>
                  <Edit className="h-3.5 w-3.5 mr-1.5" /> Edit Profile
                </Button>
              )}
            </div>
          </div>

          {!isEditing && f?.pdf_url && (
            <Button asChild size="sm" variant="secondary" className="self-start gap-2">
              <a href={f.pdf_url} target="_blank" rel="noreferrer"><FileText className="h-4 w-4" /> View PDF Dossier</a>
            </Button>
          )}
        </SheetHeader>

        <Tabs defaultValue="personal" className="flex-1 flex flex-col min-h-0">
          <TabsList className="mx-6 mt-4 grid grid-cols-3 w-auto">
            <TabsTrigger value="personal">1. Personal</TabsTrigger>
            <TabsTrigger value="farm">2. Farm Details</TabsTrigger>
            <TabsTrigger value="history">3. History</TabsTrigger>
          </TabsList>
          
          <ScrollArea className="flex-1 mt-3">
            <div className="px-6 pb-8">
              
              {/* TAB 1: PERSONAL */}
              <TabsContent value="personal" className="space-y-4 mt-0">
                <Section title="Personal Information">
                  {isEditing ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5"><Label>Father's Name *</Label><Input value={pd.fatherName} onChange={e => updatePd('fatherName', e.target.value)} /></div>
                      <div className="space-y-1.5"><Label>Mobile Number *</Label><Input value={mobile} maxLength={10} type="tel" onChange={e => setMobile(e.target.value)} /></div>
                      <div className="space-y-1.5"><Label>Alternate Mobile</Label><Input value={pd.alternateMobile} maxLength={10} type="tel" onChange={e => updatePd('alternateMobile', e.target.value)} /></div>
                      
                      <div className="space-y-1.5">
                        <Label>State *</Label>
                        <SearchableSingleSelect label="State" options={INDIAN_STATES} value={pd.state} onChange={v => { setPd(p => ({ ...p, state: v, city: '', taluka: '' })); }} placeholder="Select State" />
                      </div>
                      <div className="space-y-1.5">
                        <Label>{loadingLoc ? "District (Loading...) *" : "District *"}</Label>
                        <SearchableSingleSelect label="District" options={cities} value={pd.city} onChange={v => { setPd(p => ({ ...p, city: v, taluka: '' })); }} placeholder="Select District" />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Taluka *</Label>
                        <SearchableSingleSelect label="Taluka" options={talukas} value={pd.taluka} onChange={v => updatePd('taluka', v)} placeholder="Select Taluka" />
                      </div>

                      <div className="space-y-1.5"><Label>Pincode</Label><Input value={pd.pincode} maxLength={6} type="tel" onChange={e => updatePd('pincode', e.target.value)} /></div>
                    </div>
                  ) : (
                    <KeyValueGrid data={{ 'Mobile': f?.mobile, ...(f?.personal_details || {}) }} />
                  )}
                </Section>
              </TabsContent>

              {/* TAB 2: FARM DETAILS */}
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
                        <div className="space-y-1.5"><Label>Land Unit</Label>
                          <Select value={fd.landUnit} onValueChange={v => updateFd('landUnit', v)}>
                            <SelectTrigger><SelectValue/></SelectTrigger>
                            <SelectContent>{LAND_UNITS.map(unit => <SelectItem key={unit} value={unit}>{unit}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-1.5"><Label>Intercropping?</Label>
                          <Select value={fd.isIntercropping} onValueChange={v => updateFd('isIntercropping', v)}>
                            <SelectTrigger><SelectValue placeholder="Select..."/></SelectTrigger>
                            <SelectContent><SelectItem value="Yes">Yes</SelectItem><SelectItem value="No">No</SelectItem></SelectContent>
                          </Select>
                        </div>
                        
                        <div className="space-y-1.5 sm:col-span-2"><Label>Biofertilizer Knowledge</Label>
                          <Select value={fd.biofertilizer} onValueChange={v => updateFd('biofertilizer', v)}>
                            <SelectTrigger><SelectValue placeholder="Select..."/></SelectTrigger>
                            <SelectContent>{BIOFERTILIZER_OPTS.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>

                        {/* SEARCHABLE MULTI-SELECT 1: MAJOR CROPS */}
                        <div className="space-y-1.5 flex flex-col">
                          <Label className="font-semibold">Major Crops *</Label>
                          <SearchableMultiSelect label="Crops" options={WEST_INDIA_CROPS} selected={fd.majorCrops} onChange={v => updateFd('majorCrops', v)} />
                        </div>

                        {/* SEARCHABLE MULTI-SELECT 2: SOIL TYPES */}
                        <div className="space-y-1.5 flex flex-col">
                          <Label className="font-semibold">Soil Type *</Label>
                          <SearchableMultiSelect label="Soil" options={SOIL_TYPES} selected={fd.soilType} onChange={v => updateFd('soilType', v)} />
                        </div>
                        {fd.soilType.includes('Others') && (
                          <div className="space-y-1.5 sm:col-span-2"><Label>Specify Other Soil Type *</Label><Input value={fd.otherSoilType} onChange={e => updateFd('otherSoilType', e.target.value)} /></div>
                        )}

                        {/* SEARCHABLE MULTI-SELECT 3: WATER SOURCES */}
                        <div className="space-y-1.5 flex flex-col">
                          <Label className="font-semibold">Water Source *</Label>
                          <SearchableMultiSelect label="Source" options={WATER_SOURCES} selected={fd.waterSource} onChange={v => updateFd('waterSource', v)} />
                        </div>
                        {fd.waterSource.includes('Others') && (
                          <div className="space-y-1.5 sm:col-span-2"><Label>Specify Other Water Source *</Label><Input value={fd.otherWaterSource} onChange={e => updateFd('otherWaterSource', e.target.value)} /></div>
                        )}

                        {/* SEARCHABLE MULTI-SELECT 4: IRRIGATION TYPES */}
                        <div className="space-y-1.5 flex flex-col">
                          <Label className="font-semibold">Irrigation Types</Label>
                          <SearchableMultiSelect label="Type" options={IRRIGATION_TYPES} selected={fd.irrigationType} onChange={v => updateFd('irrigationType', v)} />
                        </div>

                        {/* SEARCHABLE MULTI-SELECT 5: FARM EQUIPMENTS */}
                        <div className="space-y-1.5 flex flex-col sm:col-span-2">
                          <Label className="font-semibold">Farm Equipments</Label>
                          <SearchableMultiSelect label="Equipment" options={FARM_EQUIPMENTS} selected={fd.farmEquipments} onChange={v => updateFd('farmEquipments', v)} />
                        </div>
                        {fd.farmEquipments.includes('Others') && (
                          <div className="space-y-1.5 sm:col-span-2"><Label>Specify Other Equipment *</Label><Input value={fd.otherFarmEquipment} onChange={e => updateFd('otherFarmEquipment', e.target.value)} /></div>
                        )}
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
                
                {/* Section: Side Trees */}
                <Section title="Side Trees">
                  {isEditing ? (
                    <div className="space-y-2">
                      {sideTrees.map((tree, i) => (
                        <div key={i} className="flex gap-2 items-center bg-background border border-border rounded-md p-1.5">
                          <Select value={tree.type} onValueChange={e => updateArr(setSideTrees, i, 'type', e)}>
                            <SelectTrigger className="h-8 flex-1 border-0 focus:ring-0 shadow-none"><SelectValue placeholder="Select Tree" /></SelectTrigger>
                            <SelectContent>{TREE_TYPES.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}</SelectContent>
                          </Select>
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

                {/* Section: Livestock */}
                <Section title="Cattles / Livestock">
                  {isEditing ? (
                    <div className="space-y-2">
                      {cattles.map((cattle, i) => (
                        <div key={i} className="flex gap-2 items-center bg-background border border-border rounded-md p-1.5">
                          <Select value={cattle.type} onValueChange={e => updateArr(setCattles, i, 'type', e)}>
                            <SelectTrigger className="h-8 flex-1 border-0 focus:ring-0 shadow-none"><SelectValue placeholder="Select Livestock" /></SelectTrigger>
                            <SelectContent>{CATTLE_TYPES.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}</SelectContent>
                          </Select>
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

              {/* TAB 3: HISTORY */}
              <TabsContent value="history" className="space-y-4 mt-0">
                <Section title="Cultivation History">
                  {isEditing ? (
                    <div className="space-y-4">
                      {pastCrops.map((crop, i) => (
                        <div key={i} className="p-3 bg-muted/20 border border-border rounded-md relative space-y-3">
                          <div className="flex justify-between items-center mb-1">
                            <Label className="font-bold text-primary">Crop Record {i + 1}</Label>
                            <Button variant="ghost" size="icon" className="text-destructive h-6 w-6" onClick={() => removeArr(setPastCrops, i)}><Trash2 className="h-4 w-4"/></Button>
                          </div>
                          
                          <div className="space-y-1.5">
                            <Label className="text-xs">Crop Name</Label>
                            <Select value={crop.cropName} onValueChange={e => updateArr(setPastCrops, i, 'cropName', e)}>
                              <SelectTrigger className="bg-background"><SelectValue placeholder="Select Crop Name" /></SelectTrigger>
                              <SelectContent>{WEST_INDIA_CROPS.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}</SelectContent>
                            </Select>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1"><Label className="text-[10px]">Area</Label><Input type="number" value={crop.area} onChange={e => updateArr(setPastCrops, i, 'area', e.target.value)} className="h-8" /></div>
                            <div className="space-y-1"><Label className="text-[10px]">Area Unit</Label>
                              <Select value={crop.areaUnit} onValueChange={e => updateArr(setPastCrops, i, 'areaUnit', e)}>
                                <SelectTrigger className="h-8 bg-background"><SelectValue /></SelectTrigger>
                                <SelectContent>{LAND_UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                              </Select>
                            </div>
                            
                            <div className="space-y-1"><Label className="text-[10px]">Yield Obtained</Label><Input type="number" value={crop.yield} onChange={e => updateArr(setPastCrops, i, 'yield', e.target.value)} className="h-8" /></div>
                            <div className="space-y-1"><Label className="text-[10px]">Yield Unit</Label>
                              <Select value={crop.yieldUnit} onValueChange={e => updateArr(setPastCrops, i, 'yieldUnit', e)}>
                                <SelectTrigger className="h-8 bg-background"><SelectValue /></SelectTrigger>
                                <SelectContent>{YIELD_UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                              </Select>
                            </div>
                            
                            {/* SEARCHABLE MULTI-SELECT FOR INPUTS USED INSIDE HISTORY ARRAY */}
                            <div className="space-y-1 flex flex-col col-span-2">
                              <Label className="text-[10px] font-semibold">Inputs Used</Label>
                              <SearchableMultiSelect label="Inputs" options={INPUTS_USED} selected={crop.inputUsed} onChange={v => updateArr(setPastCrops, i, 'inputUsed', v)} />
                            </div>

                            {crop.inputUsed.includes('Others') && (
                              <div className="space-y-1 col-span-2"><Label className="text-[10px]">Specify Other Input</Label><Input value={crop.otherInputUsed} onChange={e => updateArr(setPastCrops, i, 'otherInputUsed', e.target.value)} className="h-8" /></div>
                            )}

                            <div className="space-y-1 col-span-2"><Label className="text-[10px]">Problems Faced</Label><Input placeholder="e.g., Low rain, Pests" value={crop.problemsFaced} onChange={e => updateArr(setPastCrops, i, 'problemsFaced', e.target.value)} className="h-8" /></div>
                          </div>
                        </div>
                      ))}
                      <Button variant="outline" size="sm" className="w-full border-dashed" onClick={() => setPastCrops(p => [...p, {cropName:'', area:'', areaUnit:'Acres', inputUsed:[], otherInputUsed:'', yield:'', yieldUnit:'Quintals', problemsFaced:''}])}>
                        <Plus className="h-4 w-4 mr-2" /> Add Past Crop Record
                      </Button>
                    </div>
                  ) : (
                    <>
                      {viewPastCrops.length === 0 ? (
                        <p className="text-sm text-muted-foreground italic mb-4">No history recorded</p>
                      ) : pastCropKeys.length > 0 ? (
                        <div className="rounded-md border border-border overflow-x-auto mb-4">
                          <Table>
                            <TableHeader><TableRow className="bg-muted/50">{pastCropKeys.map(k => <TableHead key={k} className="font-semibold whitespace-nowrap">{fmtKey(k)}</TableHead>)}</TableRow></TableHeader>
                            <TableBody>
                              {viewPastCrops.map((row, i) => (
                                <TableRow key={i}>
                                  {pastCropKeys.map(k => (
                                    <TableCell key={k} className="text-sm">
                                      {row?.[k] != null ? (Array.isArray(row[k]) ? row[k].join(', ') : String(row[k])) : '—'}
                                    </TableCell>
                                  ))}
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-1.5 mb-4">{viewPastCrops.map((c, i) => <Badge key={i} variant="secondary">{String(c)}</Badge>)}</div>
                      )}
                    </>
                  )}
                </Section>
              </TabsContent>
            </div>
          </ScrollArea>
        </Tabs>

        {isEditing && (
          <SheetFooter className="px-6 py-4 border-t border-border bg-muted/20 mt-auto">
            <div className="flex w-full justify-end gap-3">
              <Button variant="ghost" onClick={() => setIsEditing(false)} disabled={saving}>
                <X className="h-4 w-4 mr-2" /> Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Save Changes
              </Button>
            </div>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default FarmerDetailSheet;