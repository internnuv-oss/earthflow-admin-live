import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Loader2, MapPin, X, Plus, ChevronDown, Search } from 'lucide-react';

const INDIAN_STATES = [ "Gujarat", "Maharashtra", "Rajasthan", "Madhya Pradesh", "Karnataka", "Punjab", "Haryana" ].sort();

// Searchable Select Component
const SearchableSelect = ({ value, onValueChange, options, placeholder, disabled }: any) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = options.filter((o: any) => o.label.toLowerCase().includes(search.toLowerCase()));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" disabled={disabled} className={`w-full justify-between font-normal ${!value && 'text-muted-foreground'}`}>
          {value ? options.find((o: any) => o.value === value)?.label : placeholder}
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <div className="flex items-center border-b px-3">
          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          <Input 
            placeholder="Search..." 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
            className="flex-1 border-0 bg-transparent py-3 focus-visible:ring-0 px-0 h-9" 
          />
        </div>
        <div className="max-h-64 overflow-y-auto p-1" onWheel={e => e.stopPropagation()} onTouchMove={e => e.stopPropagation()}>
          {filtered.length === 0 ? (
            <p className="p-4 text-center text-sm text-muted-foreground">No results found.</p>
          ) : (
            filtered.map((o: any) => (
              <div 
                key={o.value} 
                className="relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 px-2 text-sm outline-none hover:bg-muted hover:text-accent-foreground" 
                onClick={() => { onValueChange(o.value); setOpen(false); setSearch(''); }}
              >
                {o.label}
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

interface LocationBlock {
  id: string;
  state: string;
  district: string;
  taluka: string;
  villages: string[];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  editData?: { id: string; name: string; se_id: string; locations: any[] } | null; 
}

export const RouteBuilderDialog = ({ open, onOpenChange, onSuccess, editData }: Props) => {
  const { session } = useAuth();
  const { toast } = useToast();
  
  const [seOptions, setSeOptions] = useState<{id: string, name: string}[]>([]);
  const [selectedSe, setSelectedSe] = useState('');
  const [routeName, setRouteName] = useState('');
  const [saving, setSaving] = useState(false);
  const [locations, setLocations] = useState<LocationBlock[]>([]);

  useEffect(() => {
    if (open) {
      supabase.from('profiles').select('id, name').eq('role', 'SE').order('name')
        .then(({ data }) => setSeOptions(data || []));
        
      if (editData) {
        setRouteName(editData.name);
        setSelectedSe(editData.se_id);
        setLocations(editData.locations.map(l => ({ ...l, id: crypto.randomUUID() })));
      } else {
        setRouteName('');
        setSelectedSe('');
        setLocations([{ id: crypto.randomUUID(), state: 'Gujarat', district: '', taluka: '', villages: [] }]);
      }
    }
  }, [open, editData]);

  const handleAddLocation = () => setLocations([...locations, { id: crypto.randomUUID(), state: 'Gujarat', district: '', taluka: '', villages: [] }]);
  const handleRemoveLocation = (id: string) => setLocations(locations.filter(loc => loc.id !== id));

  const updateLocation = (id: string, field: keyof LocationBlock, value: any) => {
    setLocations(locations.map(loc => {
      if (loc.id === id) {
        const updated = { ...loc, [field]: value };
        if (field === 'state') { updated.district = ''; updated.taluka = ''; updated.villages = []; }
        if (field === 'district') { updated.taluka = ''; updated.villages = []; }
        if (field === 'taluka') { updated.villages = []; }
        return updated;
      }
      return loc;
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSe) return toast({ title: 'Validation Error', description: 'Please assign an SE.', variant: 'destructive' });
    if (!routeName.trim()) return toast({ title: 'Validation Error', description: 'Please enter a route name.', variant: 'destructive' });
    
    const isValid = locations.every(l => l.state && l.district && l.taluka && l.villages.length > 0);
    if (!isValid) return toast({ title: 'Validation Error', description: 'Complete all location fields and select villages.', variant: 'destructive' });

    setSaving(true);
    const cleanLocations = locations.map(({ state, district, taluka, villages }) => ({ state, district, taluka, villages }));

    try {
        if (editData) {
            const { error: routeError } = await supabase
              .from('routes')
              .update({ 
                name: routeName.trim(), 
                locations: cleanLocations,
                se_id: selectedSe 
              } as any)
              .eq('id', editData.id);
              
            if (routeError) throw routeError;
            toast({ title: 'Updated!', description: 'Route has been updated successfully.' });
            
          } else {
            const { error: routeError } = await supabase
              .from('routes')
              .insert({ 
                name: routeName.trim(), 
                locations: cleanLocations, 
                se_id: selectedSe,
                created_by: session?.user?.id 
              } as any);
              
            if (routeError) throw routeError;
            toast({ title: 'Success!', description: 'Route created and assigned directly to SE.' });
          }
      
      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: 'Error saving route', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle>{editData ? 'Edit Territory Route' : 'Build & Assign Route'}</DialogTitle>
          <DialogDescription>
            {editData ? 'Modify the locations or re-assign this route.' : 'Assign a specific territory route directly to an SE.'}
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <form id="route-form" onSubmit={handleSave} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-muted/30 p-4 rounded-lg border">
              <div className="space-y-2">
                <Label>Assigned Sales Executive *</Label>
                <SearchableSelect 
                  value={selectedSe} 
                  onValueChange={setSelectedSe} 
                  options={seOptions.map(se => ({ value: se.id, label: se.name }))} 
                  placeholder="Search & Select an SE" 
                />
              </div>
              <div className="space-y-2">
                <Label>Route Name *</Label>
                <Input placeholder="e.g. Saurashtra Route A" value={routeName} onChange={e => setRouteName(e.target.value)} required />
              </div>
            </div>

            <div className="space-y-4">
              <Label className="text-base font-semibold">Territory Blocks</Label>
              {locations.map((loc, index) => (
                <LocationRow 
                  key={loc.id} location={loc} index={index} 
                  onUpdate={(field, value) => updateLocation(loc.id, field, value)} 
                  onRemove={() => handleRemoveLocation(loc.id)} 
                  canRemove={locations.length > 1}
                />
              ))}
              <Button type="button" variant="outline" className="w-full border-dashed" onClick={handleAddLocation}>
                <Plus className="h-4 w-4 mr-2" /> Add Another Territory Block
              </Button>
            </div>
          </form>
        </div>
        
        <DialogFooter className="px-6 py-4 border-t bg-muted/10">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" form="route-form" disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} {editData ? 'Save Changes' : 'Create Route'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ==========================================
// 🚀 MIGRATED CASCADING LOCATION ROW COMPONENT
// ==========================================
const LocationRow = ({ location, index, onUpdate, onRemove, canRemove }: any) => {
  const [dbDistricts, setDbDistricts] = useState<any[]>([]);
  const [dbTalukas, setDbTalukas] = useState<any[]>([]);
  const [dbVillages, setDbVillages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // 1. Fetch all districts from Supabase on mount
  useEffect(() => {
    setLoading(true);
    supabase.from('districts').select('*').order('name')
      .then(({ data }) => {
        if (data) setDbDistricts(data);
        setLoading(false);
      });
  }, []);

  // 2. Fetch Talukas when District name selection changes
  useEffect(() => {
    if (!location.district) { setDbTalukas([]); return; }
    const match = dbDistricts.find(d => d.name === location.district);
    if (!match) return;

    supabase.from('talukas').select('*').eq('district_id', match.id).order('name')
      .then(({ data }) => {
        if (data) setDbTalukas(data);
      });
  }, [location.district, dbDistricts]);

  // 3. Fetch Villages when Taluka name selection changes
  useEffect(() => {
    if (!location.taluka) { setDbVillages([]); return; }
    const match = dbTalukas.find(t => t.name === location.taluka);
    if (!match) return;

    supabase.from('villages').select('*').eq('taluka_id', match.id).order('name')
      .then(({ data }) => {
        if (data) setDbVillages(data);
      });
  }, [location.taluka, dbTalukas]);

  const toggleVillage = (vName: string) => {
    const current = new Set(location.villages);
    if (current.has(vName)) current.delete(vName);
    else current.add(vName);
    onUpdate('villages', Array.from(current));
  };

  return (
    <div className="p-4 bg-card border rounded-lg shadow-sm space-y-4">
      <div className="flex justify-between items-center mb-1">
        <h4 className="font-semibold text-sm flex items-center gap-2 text-primary">
          <MapPin className="h-4 w-4" /> Block {index + 1} {loading && <Loader2 className="h-3 w-3 animate-spin" />}
        </h4>
        {canRemove && (
          <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:bg-destructive/10" onClick={onRemove}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs">State *</Label>
          <SearchableSelect 
            value={location.state} 
            onValueChange={(val: any) => onUpdate('state', val)} 
            options={INDIAN_STATES.map(s => ({ value: s, label: s }))} 
            placeholder="Search State" 
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">District *</Label>
          <SearchableSelect 
            value={location.district} 
            onValueChange={(val: any) => onUpdate('district', val)} 
            options={dbDistricts.map(d => ({ value: d.name, label: d.name }))} 
            placeholder="Search District" 
            disabled={!location.state || loading}
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Taluka *</Label>
          <SearchableSelect 
            value={location.taluka} 
            onValueChange={(val: any) => onUpdate('taluka', val)} 
            options={dbTalukas.map(t => ({ value: t.name, label: t.name }))} 
            placeholder="Search Taluka" 
            disabled={!location.district}
          />
        </div>
      </div>

      <div className="space-y-1.5 pt-1">
        <Label className="text-xs">Villages Covered *</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" role="combobox" disabled={!location.taluka} className="w-full justify-between font-normal h-auto min-h-[40px] px-3 py-2">
              {location.villages.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {location.villages.slice(0, 5).map((v: string) => <Badge key={v} variant="secondary" className="font-normal">{v}</Badge>)}
                  {location.villages.length > 5 && <Badge variant="secondary" className="font-normal">+{location.villages.length - 5} more</Badge>}
                </div>
              ) : (
                <span className="text-muted-foreground">{!location.taluka ? "Select Taluka first..." : "Select multiple villages..."}</span>
              )}
              <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          
          <PopoverContent className="w-[300px] p-0" align="start">
            <div className="max-h-64 overflow-y-auto p-3" onWheel={e => e.stopPropagation()} onTouchMove={e => e.stopPropagation()}>
              {dbVillages.length === 0 ? (
                <p className="text-sm text-center text-muted-foreground py-4">No villages found.</p>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center space-x-2 pb-2 border-b sticky top-0 bg-popover z-10">
                    <Checkbox 
                      checked={location.villages.length === dbVillages.length} 
                      onCheckedChange={(checked) => onUpdate('villages', checked ? dbVillages.map(v => v.name) : [])} 
                    />
                    <Label className="text-sm font-semibold">Select All ({dbVillages.length})</Label>
                  </div>
                  {dbVillages.map((v) => (
                    <div key={v.id} className="flex items-center space-x-2 cursor-pointer" onClick={() => toggleVillage(v.name)}>
                      <Checkbox checked={location.villages.includes(v.name)} onCheckedChange={() => toggleVillage(v.name)} />
                      <Label className="text-sm font-normal cursor-pointer leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                        {v.name}
                      </Label>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
};