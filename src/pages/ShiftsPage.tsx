import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { Loader2, Shield, Clock, Plus, Edit, User, Calendar as CalendarIcon, Car } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';

const ShiftsPage = ({ onLogout }: { onLogout: () => void }) => {
  const { session, loading: authLoading } = useAuth();
  const userId = session?.user?.id;
  
  const { getModulePerm, loading: permLoading } = usePermissions(userId || '');
  const shiftAccess = getModulePerm('shifts'); 
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [shifts, setShifts] = useState<any[]>([]);
  const [seList, setSeList] = useState<{id: string, name: string}[]>([]);
  
  // Filters
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [selectedSE, setSelectedSE] = useState('All');

  // Editor State
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);

  // Editor Form State
  const [formData, setFormData] = useState({
    se_id: '',
    status: 'ACTIVE',
    start_time: '',
    end_time: '',
    is_personal_vehicle: false,
    start_km: '',
    end_km: '',
    total_distance: 0,
    date: ''
  });

  // 1. Fetch SE List
  useEffect(() => {
    if (!userId || !shiftAccess.can_view) return;
    supabase.from('profiles').select('id, name').eq('role', 'SE').eq('is_demo', false).order('name')
      .then(({ data }) => { if (data) setSeList(data); });
  }, [userId, shiftAccess.can_view]);

  // 2. Fetch Shifts based on filters
  // 2. Fetch Shifts based on filters (Filtering out Demo Executives)
  const fetchShifts = async () => {
    setLoading(true);
    
    // 🚀 FIXED: Inner join syntax 'profiles!inner(name, is_demo)' forces Supabase 
    // to filter the shifts table based on conditions inside the linked profiles table
    let query = supabase
      .from('shifts')
      .select('*, profiles!inner(name, is_demo)')
      .eq('profiles.is_demo', false) // 🚀 EXCLUDE DEMO EXECUTIVES HERE
      .order('start_time', { ascending: false });

    if (selectedDate) query = query.eq('date', selectedDate);
    if (selectedSE !== 'All') query = query.eq('se_id', selectedSE);

    const { data } = await query;
    if (data) setShifts(data);
    setLoading(false);
  };
  
  useEffect(() => {
    if (userId && shiftAccess.can_view) fetchShifts();
  }, [selectedDate, selectedSE, userId, shiftAccess.can_view]);

  // Utility: Convert Unix MS to DateTime-Local string for inputs
  const formatForInput = (ms: number | null) => {
    if (!ms) return '';
    const d = new Date(Number(ms));
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  };

  const handleOpenEditor = (shift: any = null) => {
    if (shift) {
      // 🚀 EDIT MODE: Target exact row by capturing entire object (including unique id)
      setEditingShift(shift);
      setFormData({
        se_id: shift.se_id,
        status: shift.status,
        start_time: formatForInput(shift.start_time),
        end_time: formatForInput(shift.end_time),
        is_personal_vehicle: shift.is_personal_vehicle || false,
        start_km: shift.start_km || '',
        end_km: shift.end_km || '',
        total_distance: shift.total_distance || 0,
        date: shift.date
      });
    } else {
      // 🚀 CREATE MODE: Start fresh
      setEditingShift(null);
      setFormData({
        se_id: '',
        status: 'ACTIVE',
        start_time: formatForInput(Date.now()),
        end_time: '',
        is_personal_vehicle: false,
        start_km: '',
        end_km: '',
        total_distance: 0,
        date: ''
      });
    }
    setIsEditorOpen(true);
  };

  const handleSaveShift = async () => {
    if (!formData.se_id || !formData.start_time) {
      return toast({ title: 'Validation Error', description: 'Executive and Start Time are required.', variant: 'destructive' });
    }

    setSaving(true);
    
    const startDateObj = new Date(formData.start_time);
    const startMs = startDateObj.getTime();
    const endMs = formData.end_time ? new Date(formData.end_time).getTime() : null;

    // 1. Auto-generate the date string from the Punch In time
    const calculatedDateString = startDateObj.toISOString().split('T')[0];
    const calculatedStatus = endMs ? 'COMPLETED' : 'ACTIVE';

    // 🚀 2. DUP-CHECK: Look up if this SE already has a shift on this specific date
    let checkQuery = supabase
      .from('shifts')
      .select('id')
      .eq('se_id', formData.se_id)
      .eq('date', calculatedDateString);

    // If we are editing, ignore the current row itself
    if (editingShift) {
      checkQuery = checkQuery.neq('id', editingShift.id);
    }

    const { data: existingShifts, error: checkError } = await checkQuery;

    if (checkError) {
      setSaving(false);
      return toast({ title: 'Database Error', description: checkError.message, variant: 'destructive' });
    }

    // 🚀 3. RESTRICTION: Block saving if an entry is found!
    if (existingShifts && existingShifts.length > 0) {
      setSaving(false);
      return toast({ 
        title: 'Shift Conflict', 
        description: `This executive already has a shift record created for ${new Date(calculatedDateString).toLocaleDateString('en-IN')}. Duplicate entries are restricted.`, 
        variant: 'destructive' 
      });
    }

    // 4. Construct payload if validation passes
    const payload = {
      se_id: formData.se_id,
      date: calculatedDateString, 
      status: calculatedStatus,
      start_time: startMs,
      end_time: endMs,
      is_personal_vehicle: formData.is_personal_vehicle,
      start_km: formData.start_km,
      end_km: formData.end_km,
      total_distance: parseFloat(formData.total_distance.toString()) || 0,
    };

    let error;
    if (editingShift) {
      const res = await supabase.from('shifts').update(payload).eq('id', editingShift.id);
      error = res.error;
    } else {
      const res = await supabase.from('shifts').insert([payload]);
      error = res.error;
    }

    setSaving(false);

    if (error) {
      toast({ title: 'Error saving shift', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: `Shift ${editingShift ? 'updated' : 'created'} successfully!` });
      setIsEditorOpen(false);
      fetchShifts();
    }
  };

  if (authLoading || permLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;

  if (!permLoading && !shiftAccess.can_view) {
    return (
      <AppLayout onLogout={onLogout}>
        <div className="flex flex-col items-center justify-center h-[60vh] text-center">
          <Shield className="h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold">Access Denied</h2>
          <p className="text-muted-foreground">You do not have permission to manage shifts.</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout onLogout={onLogout}>
      <div className="space-y-6">
        
        {/* Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" /> Shift Management
            </h2>
            <p className="text-sm text-muted-foreground">Adjust, correct, or append field executive shift records.</p>
          </div>

          {shiftAccess.can_edit && (
            <Button onClick={() => handleOpenEditor()} className="gap-2">
              <Plus className="h-4 w-4" /> Create Shift Override
            </Button>
          )}
        </div>

        {/* Filters Bar */}
        <div className="bg-card border rounded-lg p-3 shadow-sm flex flex-col sm:flex-row gap-4 items-center">
          <div className="relative flex items-center w-full sm:w-auto">
            <CalendarIcon className="absolute left-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="pl-9 h-9" />
          </div>
          
          <div className="relative flex items-center w-full sm:w-auto">
            <User className="absolute left-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
            <select value={selectedSE} onChange={(e) => setSelectedSE(e.target.value)} className="flex h-9 w-full min-w-[200px] items-center justify-between rounded-md border border-input bg-transparent pl-9 pr-3 py-2 text-sm shadow-sm">
              <option value="All">All Executives</option>
              {seList.map(se => <option key={se.id} value={se.id}>{se.name}</option>)}
            </select>
          </div>
        </div>

        {/* Dynamic List Table */}
        <div className="bg-card border rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : shifts.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">No shifts found for this date criteria.</div>
            ) : (
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="px-4 py-3 font-semibold text-muted-foreground">Executive</th>
                    <th className="px-4 py-3 font-semibold text-muted-foreground">Status</th>
                    <th className="px-4 py-3 font-semibold text-muted-foreground">Start Time</th>
                    <th className="px-4 py-3 font-semibold text-muted-foreground">End Time</th>
                    <th className="px-4 py-3 font-semibold text-muted-foreground">Distance / Vehicle</th>
                    <th className="px-4 py-3 font-semibold text-muted-foreground text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {shifts.map((shift) => (
                    <tr key={shift.id} className="hover:bg-muted/20">
                      <td className="px-4 py-3 font-medium">{shift.profiles?.name || 'Unknown'}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={shift.status === 'ACTIVE' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-slate-100 text-slate-700'}>
                          {shift.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">{new Date(Number(shift.start_time)).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
                      <td className="px-4 py-3">{shift.end_time ? new Date(Number(shift.end_time)).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {shift.is_personal_vehicle && <Car className="h-3.5 w-3.5 text-blue-500" />}
                          <span>{shift.total_distance || 0} km</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {shiftAccess.can_edit && (
                          <Button variant="ghost" size="sm" onClick={() => handleOpenEditor(shift)} className="h-8">
                            <Edit className="h-4 w-4 text-muted-foreground hover:text-primary" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Slide-out Panel Form */}
      <Sheet open={isEditorOpen} onOpenChange={setIsEditorOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-0">
          <SheetHeader className="px-6 py-4 border-b bg-muted/30">
            <SheetTitle>{editingShift ? 'Modify Existing Shift' : 'Create Manual Shift'}</SheetTitle>
            <SheetDescription>
              Provide timestamps. Date handles automatically on submission.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
            <div className="space-y-1.5">
              <Label>Sales Executive</Label>
              <select 
                value={formData.se_id} 
                onChange={e => setFormData({...formData, se_id: e.target.value})}
                disabled={!!editingShift} 
                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50"
              >
                <option value="" disabled>Select Executive...</option>
                {seList.map(se => <option key={se.id} value={se.id}>{se.name}</option>)}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label>Start Time (Punch In Date & Time) *</Label>
              <Input type="datetime-local" value={formData.start_time} onChange={e => setFormData({...formData, start_time: e.target.value})} />
            </div>

            <div className="space-y-1.5">
              <Label>End Time (Punch Out Date & Time)</Label>
              <Input type="datetime-local" value={formData.end_time} onChange={e => setFormData({...formData, end_time: e.target.value})} />
            </div>

            <div className="bg-muted/40 p-4 rounded-lg border space-y-4 mt-2">
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="pv" 
                  checked={formData.is_personal_vehicle} 
                  onCheckedChange={(checked) => setFormData({...formData, is_personal_vehicle: !!checked})} 
                />
                <Label htmlFor="pv" className="font-semibold cursor-pointer">Used Personal Vehicle?</Label>
              </div>

              {formData.is_personal_vehicle && (
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Start Odometer</Label>
                    <Input placeholder="e.g. 12050" value={formData.start_km} onChange={e => setFormData({...formData, start_km: e.target.value})} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">End Odometer</Label>
                    <Input placeholder="e.g. 12110" value={formData.end_km} onChange={e => setFormData({...formData, end_km: e.target.value})} />
                  </div>
                </div>
              )}
              
              <div className="space-y-1.5 pt-2 border-t">
                <Label className="text-xs">Total Distance Override (km)</Label>
                <Input type="number" step="0.1" value={formData.total_distance} onChange={e => setFormData({...formData, total_distance: parseFloat(e.target.value) || 0})} />
              </div>
            </div>
          </div>

          <SheetFooter className="px-6 py-4 border-t bg-muted/10">
            <Button variant="ghost" onClick={() => setIsEditorOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveShift} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null} Save Shift Records
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </AppLayout>
  );
};

export default ShiftsPage;