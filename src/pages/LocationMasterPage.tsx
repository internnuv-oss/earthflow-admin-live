import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { useToast } from '@/hooks/use-toast';
import AppLayout from '@/components/AppLayout';
import { Loader2, Shield, Plus, Edit2, Trash2, Map, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';

type LocationEntity = 'district' | 'taluka' | 'village';

export default function LocationMasterPage({ onLogout }: { onLogout: () => void }) {
  const { session, loading: authLoading } = useAuth();
  const { getModulePerm, loading: permLoading } = usePermissions(session?.user?.id || '');
  const locAccess = getModulePerm('locations');
  const { toast } = useToast();

  // Data States
  const [districts, setDistricts] = useState<any[]>([]);
  const [talukas, setTalukas] = useState<any[]>([]);
  const [villages, setVillages] = useState<any[]>([]);

  // Selection States
  const [activeDistrict, setActiveDistrict] = useState<any>(null);
  const [activeTaluka, setActiveTaluka] = useState<any>(null);

  // Modal States
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState<LocationEntity>('district');
  const [editItem, setEditItem] = useState<any>(null);
  const [itemName, setItemName] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(true);

  // 1. Fetch Initial Districts
  useEffect(() => {
    if (locAccess.can_view) fetchDistricts();
  }, [locAccess.can_view]);

  const fetchDistricts = async () => {
    setLoadingInitial(true);
    const { data } = await supabase.from('districts').select('*').order('name');
    if (data) setDistricts(data);
    setLoadingInitial(false);
  };

  // 2. Fetch Talukas when a District is selected
  const handleSelectDistrict = async (dist: any) => {
    setActiveDistrict(dist);
    setActiveTaluka(null); // Reset child
    setVillages([]); // Reset grandchild
    const { data } = await supabase.from('talukas').select('*').eq('district_id', dist.id).order('name');
    if (data) setTalukas(data);
  };

  // 3. Fetch Villages when a Taluka is selected
  const handleSelectTaluka = async (tal: any) => {
    setActiveTaluka(tal);
    const { data } = await supabase.from('villages').select('*').eq('taluka_id', tal.id).order('name');
    if (data) setVillages(data);
  };

  // 4. Handle Save (Create / Update)
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName.trim()) return;
    setSaving(true);

    let table = modalType === 'district' ? 'districts' : modalType === 'taluka' ? 'talukas' : 'villages';
    
    // Prepare Payload
    const payload: any = { name: itemName.trim() };
    if (modalType === 'taluka') payload.district_id = activeDistrict.id;
    if (modalType === 'village') payload.taluka_id = activeTaluka.id;

    let error;
    if (editItem) {
      // Update
      const res = await supabase.from(table as any).update(payload).eq('id', editItem.id);
      error = res.error;
    } else {
      // Insert
      const res = await supabase.from(table as any).insert([payload]);
      error = res.error;
    }

    setSaving(false);

    if (error) {
      toast({ title: 'Error saving location', description: error.message, variant: 'destructive' });
      return;
    }

    toast({ title: 'Success', description: `${modalType} saved successfully.` });
    setModalOpen(false);
    
    // Refresh the correct column
    if (modalType === 'district') fetchDistricts();
    if (modalType === 'taluka') handleSelectDistrict(activeDistrict);
    if (modalType === 'village') handleSelectTaluka(activeTaluka);
  };

  // 5. Handle Delete
  const handleDelete = async (e: React.MouseEvent, type: LocationEntity, id: string, name: string) => {
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to delete ${name}? This will also delete all data inside it.`)) return;
    
    let table = type === 'district' ? 'districts' : type === 'taluka' ? 'talukas' : 'villages';
    const { error } = await supabase.from(table as any).delete().eq('id', id);

    if (error) {
      toast({ title: 'Error deleting', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Deleted', description: `${name} has been removed.` });
      if (type === 'district') {
        fetchDistricts();
        if (activeDistrict?.id === id) { setActiveDistrict(null); setActiveTaluka(null); setTalukas([]); setVillages([]); }
      }
      if (type === 'taluka') {
        handleSelectDistrict(activeDistrict);
        if (activeTaluka?.id === id) { setActiveTaluka(null); setVillages([]); }
      }
      if (type === 'village') handleSelectTaluka(activeTaluka);
    }
  };

  // Open Modal Helper
  const openModal = (type: LocationEntity, item: any = null) => {
    setModalType(type);
    setEditItem(item);
    setItemName(item ? item.name : '');
    setModalOpen(true);
  };

  if (authLoading || permLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;
  
  if (!locAccess.can_view) {
    return (
      <AppLayout onLogout={onLogout}>
        <div className="flex flex-col items-center justify-center h-[60vh] text-center">
          <Shield className="h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold">Access Denied</h2>
        </div>
      </AppLayout>
    );
  }

  // Helper component for List Items
  const ListItem = ({ item, type, isActive, onClick }: { item: any, type: LocationEntity, isActive: boolean, onClick: () => void }) => (
    <div 
      onClick={onClick}
      className={`flex items-center justify-between p-3 border-b cursor-pointer transition-colors ${isActive ? 'bg-primary/10 border-l-4 border-l-primary' : 'hover:bg-muted/50 border-l-4 border-l-transparent'}`}
    >
      <span className={`text-sm font-medium ${isActive ? 'text-primary font-bold' : ''}`}>{item.name}</span>
      <div className="flex items-center gap-1">
        {locAccess.can_edit && (
          <>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary" onClick={(e) => { e.stopPropagation(); openModal(type, item); }}>
              <Edit2 className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-red-600" onClick={(e) => handleDelete(e, type, item.id, item.name)}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </>
        )}
        {type !== 'village' && <ChevronRight className={`h-4 w-4 ml-1 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />}
      </div>
    </div>
  );

  return (
    <AppLayout onLogout={onLogout}>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2"><Map className="h-5 w-5 text-primary" /> Location Master</h2>
          <p className="text-sm text-muted-foreground">Manage your territory hierarchy: Districts, Talukas, and Villages.</p>
        </div>

        {/* 3-Column Layout */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-[65vh]">
          
          {/* COLUMN 1: DISTRICTS */}
          <div className="bg-card border rounded-lg shadow-sm flex flex-col overflow-hidden">
            <div className="bg-muted/50 p-3 border-b flex justify-between items-center">
              <h3 className="font-semibold text-sm">1. Districts</h3>
              {locAccess.can_edit && (
                <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => openModal('district')}>
                  <Plus className="h-3 w-3 mr-1" /> Add
                </Button>
              )}
            </div>
            <ScrollArea className="flex-1">
              {loadingInitial ? (
                <div className="flex justify-center p-8"><Loader2 className="animate-spin h-5 w-5 text-muted-foreground" /></div>
              ) : districts.length === 0 ? (
                <div className="text-center p-8 text-sm text-muted-foreground">No districts added yet.</div>
              ) : (
                districts.map(d => <ListItem key={d.id} item={d} type="district" isActive={activeDistrict?.id === d.id} onClick={() => handleSelectDistrict(d)} />)
              )}
            </ScrollArea>
          </div>

          {/* COLUMN 2: TALUKAS */}
          <div className="bg-card border rounded-lg shadow-sm flex flex-col overflow-hidden">
            <div className="bg-muted/50 p-3 border-b flex justify-between items-center">
              <h3 className="font-semibold text-sm">2. Talukas {activeDistrict && <span className="text-primary">({activeDistrict.name})</span>}</h3>
              {locAccess.can_edit && activeDistrict && (
                <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => openModal('taluka')}>
                  <Plus className="h-3 w-3 mr-1" /> Add
                </Button>
              )}
            </div>
            <ScrollArea className="flex-1">
              {!activeDistrict ? (
                <div className="text-center p-8 text-sm text-muted-foreground italic">Select a district first.</div>
              ) : talukas.length === 0 ? (
                <div className="text-center p-8 text-sm text-muted-foreground">No talukas found.</div>
              ) : (
                talukas.map(t => <ListItem key={t.id} item={t} type="taluka" isActive={activeTaluka?.id === t.id} onClick={() => handleSelectTaluka(t)} />)
              )}
            </ScrollArea>
          </div>

          {/* COLUMN 3: VILLAGES */}
          <div className="bg-card border rounded-lg shadow-sm flex flex-col overflow-hidden">
            <div className="bg-muted/50 p-3 border-b flex justify-between items-center">
              <h3 className="font-semibold text-sm">3. Villages {activeTaluka && <span className="text-primary">({activeTaluka.name})</span>}</h3>
              {locAccess.can_edit && activeTaluka && (
                <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => openModal('village')}>
                  <Plus className="h-3 w-3 mr-1" /> Add
                </Button>
              )}
            </div>
            <ScrollArea className="flex-1">
              {!activeTaluka ? (
                <div className="text-center p-8 text-sm text-muted-foreground italic">Select a taluka first.</div>
              ) : villages.length === 0 ? (
                <div className="text-center p-8 text-sm text-muted-foreground">No villages found.</div>
              ) : (
                villages.map(v => <ListItem key={v.id} item={v} type="village" isActive={false} onClick={() => {}} />)
              )}
            </ScrollArea>
          </div>

        </div>
      </div>

      {/* Add / Edit Dialog */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleSave}>
            <DialogHeader>
              <DialogTitle className="capitalize">{editItem ? 'Edit' : 'Add'} {modalType}</DialogTitle>
            </DialogHeader>
            <div className="py-6 space-y-4">
              {modalType === 'taluka' && (
                <div className="text-sm text-muted-foreground">Adding to District: <strong className="text-foreground">{activeDistrict?.name}</strong></div>
              )}
              {modalType === 'village' && (
                <div className="text-sm text-muted-foreground">Adding to Taluka: <strong className="text-foreground">{activeTaluka?.name}</strong></div>
              )}
              <div className="space-y-2">
                <Label htmlFor="name">{modalType} Name *</Label>
                <Input 
                  id="name" 
                  value={itemName} 
                  onChange={e => setItemName(e.target.value)} 
                  required 
                  autoFocus 
                  placeholder={`Enter ${modalType} name`} 
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}