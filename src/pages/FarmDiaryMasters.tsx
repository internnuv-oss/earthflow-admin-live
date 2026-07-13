import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import AppLayout from '@/components/AppLayout';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Plus, Settings, Ruler, Leaf, ListTree, Link as LinkIcon, AlertCircle, Trash2, CheckSquare, Map, ChevronUp, ChevronDown } from 'lucide-react';

export default function FarmDiaryMasters({ onLogout }: { onLogout: () => void }) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('crops');
  const [loading, setLoading] = useState(false);
  
  // Master Data States
  const [crops, setCrops] = useState<any[]>([]);
  const [stages, setStages] = useState<any[]>([]);
  const [uoms, setUoms] = useState<any[]>([]);
  const [parameters, setParameters] = useState<any[]>([]);
  
  // SOP BUILDER STATES
  const [layoutCategory, setLayoutCategory] = useState<string>('');
  const [layoutCrops, setLayoutCrops] = useState<string[]>([]);
  const [layoutStages, setLayoutStages] = useState<string[]>([]); 
  const [activeSopStage, setActiveSopStage] = useState<string>(''); 
  const [layoutMatrix, setLayoutMatrix] = useState<any[]>([]);
  
  // 🚀 FIXED: Removed manual sequence order from state, it's now auto-calculated
  const [sopForm, setSopForm] = useState({ visitIteration: 1, paramId: '', isMandatory: false });

  // Modal States
  const [isCropOpen, setIsCropOpen] = useState(false);
  const [isStageOpen, setIsStageOpen] = useState(false);
  const [isUomOpen, setIsUomOpen] = useState(false);
  const [isParamOpen, setIsParamOpen] = useState(false);
  const [isMapUomOpen, setIsMapUomOpen] = useState(false);
  
  // UOM Mapping States
  const [activeParam, setActiveParam] = useState<any>(null);
  const [selectedUoms, setSelectedUoms] = useState<string[]>([]);
  const [defaultUom, setDefaultUom] = useState<string>('');

  // Form States
  const [newCrop, setNewCrop] = useState({ name: '', category: '' });
  const [isAddingNewCategory, setIsAddingNewCategory] = useState(false);
  const [newStage, setNewStage] = useState({ name: '' });
  const [newUom, setNewUom] = useState({ name: '', symbol: '' });
  const [newParam, setNewParam] = useState({ label: '', type: 'Numeric', options: '' });

  const db = supabase as any;

  useEffect(() => { fetchMasters(); }, []);

  useEffect(() => {
    if (layoutCrops.length > 0 && layoutStages.length > 0) {
      if (!activeSopStage || !layoutStages.includes(activeSopStage)) {
        setActiveSopStage(layoutStages[0]); 
      }
      fetchLayoutMatrix();
    } else {
      setLayoutMatrix([]);
      setActiveSopStage('');
    }
  }, [layoutCrops, layoutStages]);

  const fetchMasters = async () => {
    setLoading(true);
    const [cropsRes, stagesRes, uomRes, paramsRes] = await Promise.all([
      db.from('master_crops').select('*').order('crop_name'),
      db.from('master_crop_stages').select('*').order('stage_name'),
      db.from('master_uom').select('*').order('uom_name'),
      db.from('master_parameters').select('*').order('parameter_label')
    ]);

    if (cropsRes.data) setCrops(cropsRes.data);
    if (stagesRes.data) setStages(stagesRes.data);
    if (uomRes.data) setUoms(uomRes.data);
    if (paramsRes.data) setParameters(paramsRes.data);
    setLoading(false);
  };

  const fetchLayoutMatrix = async () => {
    if (layoutCrops.length === 0 || layoutStages.length === 0) return;
    const previewCropId = layoutCrops[0]; 
    
    const { data, error } = await db
      .from('crop_stage_parameter_layout')
      .select(`id, sequence_order, is_mandatory, parameter_id, visit_iteration, stage_id, stage_sequence, master_parameters ( parameter_label, ui_input_type )`)
      .eq('crop_id', previewCropId)
      .in('stage_id', layoutStages)
      .order('stage_sequence', { ascending: true })
      .order('visit_iteration', { ascending: true })
      .order('sequence_order', { ascending: true });
    
    if (data) setLayoutMatrix(data as any[]);
  };

  const uniqueCategories = Array.from(new Set(crops.map(c => c.crop_category).filter(Boolean)));
  const filteredCropsForLayout = crops.filter(c => layoutCategory ? c.crop_category === layoutCategory : true);

  // --- SELECTION & ORDERING TOGGLES ---
  const toggleLayoutCrop = (cropId: string) => {
    setLayoutCrops(prev => prev.includes(cropId) ? prev.filter(id => id !== cropId) : [...prev, cropId]);
  };
  
  const toggleLayoutStage = (stageId: string) => {
    setLayoutStages(prev => prev.includes(stageId) ? prev.filter(id => id !== stageId) : [...prev, stageId]);
  };
  
  const selectAllFilteredCrops = () => setLayoutCrops(filteredCropsForLayout.map(c => c.id));

  // 🚀 FIXED: Stage Sequence Reordering Functions
  const moveStageUp = (index: number) => {
    if (index === 0) return;
    const newStages = [...layoutStages];
    [newStages[index - 1], newStages[index]] = [newStages[index], newStages[index - 1]];
    setLayoutStages(newStages);
  };

  const moveStageDown = (index: number) => {
    if (index === layoutStages.length - 1) return;
    const newStages = [...layoutStages];
    [newStages[index + 1], newStages[index]] = [newStages[index], newStages[index + 1]];
    setLayoutStages(newStages);
  };

  // --- ADD MASTERS LOGIC ---
  const handleAddCrop = async () => {
    if (!newCrop.name.trim() || !newCrop.category.trim()) return toast({ title: "Error", description: "Crop name and category required", variant: "destructive" });
    if (crops.some(c => c.crop_name.toLowerCase() === newCrop.name.trim().toLowerCase())) return toast({ title: "Duplicate", description: "Crop exists.", variant: "destructive" });
    const { error } = await db.from('master_crops').insert([{ crop_name: newCrop.name.trim(), crop_category: newCrop.category.trim(), status: 'Active' }]);
    if (error) return toast({ title: "Error", description: error.message, variant: "destructive" });
    toast({ title: "Success", description: "Crop added!" });
    setIsCropOpen(false); setNewCrop({ name: '', category: '' }); setIsAddingNewCategory(false); fetchMasters();
  };

  const handleAddStage = async () => {
    const stageName = newStage.name.trim();
    if (!stageName) return toast({ title: "Error", description: "Stage Name required", variant: "destructive" });
    if (stages.some(s => s.stage_name.toLowerCase() === stageName.toLowerCase())) return toast({ title: "Duplicate", description: "Stage exists.", variant: "destructive" });
    const generatedCode = stageName.replace(/[^a-zA-Z]/g, '').substring(0, 3).toUpperCase() || 'STG';
    const { error } = await db.from('master_crop_stages').insert([{ stage_name: stageName, stage_code: generatedCode }]);
    if (error) return toast({ title: "Error", description: error.message, variant: "destructive" });
    toast({ title: "Success", description: "Stage added!" });
    setIsStageOpen(false); setNewStage({ name: '' }); fetchMasters();
  };

  const handleAddUom = async () => {
    const uomName = newUom.name.trim(); const uomSymbol = newUom.symbol.trim();
    if (!uomName || !uomSymbol) return toast({ title: "Error", description: "Name and Symbol required", variant: "destructive" });
    if (uoms.some(u => u.uom_name.toLowerCase() === uomName.toLowerCase() || u.uom_symbol.toLowerCase() === uomSymbol.toLowerCase())) return toast({ title: "Duplicate", description: "UOM exists.", variant: "destructive" });
    const { error } = await db.from('master_uom').insert([{ uom_name: uomName, uom_symbol: uomSymbol }]);
    if (error) return toast({ title: "Error", description: error.message, variant: "destructive" });
    toast({ title: "Success", description: "UOM added!" });
    setIsUomOpen(false); setNewUom({ name: '', symbol: '' }); fetchMasters();
  };

  const handleAddParameter = async () => {
    const paramLabel = newParam.label.trim();
    if (!paramLabel) return toast({ title: "Error", description: "Parameter Label required", variant: "destructive" });
    let optionsJson: string[] = [];
    if (newParam.type === 'Dropdown Choice') {
      if (!newParam.options.trim()) return toast({ title: "Error", description: "Options are required for dropdowns", variant: "destructive" });
      optionsJson = newParam.options.split(',').map(s => s.trim()).filter(Boolean);
    }
    const { error } = await db.from('master_parameters').insert([{ parameter_label: paramLabel, ui_input_type: newParam.type, options_data: optionsJson }]);
    if (error) return toast({ title: "Error", description: error.message, variant: "destructive" });
    toast({ title: "Success", description: "Parameter added!" });
    setIsParamOpen(false); setNewParam({ label: '', type: 'Numeric', options: '' }); fetchMasters();
  };

  const openUomMapping = async (param: any) => {
    setActiveParam(param);
    const { data } = await db.from('parameter_uom_mapping').select('*').eq('parameter_id', param.id);
    const uomData = data as any[] | null;
    if (uomData) {
      setSelectedUoms(uomData.map((m: any) => m.uom_id));
      const def = uomData.find((m: any) => m.is_default_uom);
      setDefaultUom(def ? def.uom_id : '');
    } else {
      setSelectedUoms([]); setDefaultUom('');
    }
    setIsMapUomOpen(true);
  };

  const saveUomMapping = async () => {
    if (selectedUoms.length > 0 && !defaultUom) return toast({ title: "Error", description: "Please select a default UOM", variant: "destructive" });
    await db.from('parameter_uom_mapping').delete().eq('parameter_id', activeParam.id);
    if (selectedUoms.length > 0) {
      const inserts = selectedUoms.map(uomId => ({ parameter_id: activeParam.id, uom_id: uomId, is_default_uom: uomId === defaultUom }));
      const { error } = await db.from('parameter_uom_mapping').insert(inserts);
      if (error) return toast({ title: "Error", description: error.message, variant: "destructive" });
    }
    toast({ title: "Success", description: "UOMs mapped successfully!" });
    setIsMapUomOpen(false);
  };

  const toggleUomSelection = (uomId: string) => {
    setSelectedUoms(prev => {
      const isSelected = prev.includes(uomId);
      const newSelection = isSelected ? prev.filter(id => id !== uomId) : [...prev, uomId];
      if (isSelected && defaultUom === uomId) setDefaultUom('');
      return newSelection;
    });
  };

  // --- 🚀 SOP BUILDER LOGIC ---
  const handleAddParamToSOP = async () => {
    if (layoutCrops.length === 0 || !activeSopStage || !sopForm.paramId || !sopForm.visitIteration) {
      return toast({ title: "Error", description: "Crops, Stage, Iteration, and Parameter are required", variant: "destructive" });
    }
    
    // Check for duplicates
    const isDuplicate = layoutMatrix.some(m => 
      m.stage_id === activeSopStage && 
      m.visit_iteration === sopForm.visitIteration && 
      m.parameter_id === sopForm.paramId
    );

    if (isDuplicate) {
      return toast({ title: "Duplicate", description: "Parameter is already assigned to this visit", variant: "destructive" });
    }

    // 🚀 FIXED: Auto-calculate the next sequence order for this specific Visit and Stage
    const currentVisitParams = layoutMatrix.filter(m => m.stage_id === activeSopStage && m.visit_iteration === sopForm.visitIteration);
    const nextSeqOrder = currentVisitParams.length > 0 ? Math.max(...currentVisitParams.map(m => m.sequence_order)) + 1 : 1;
    
    // Calculate the overall Stage Sequence (Execution Order) based on the array position
    const currentStageSequence = layoutStages.indexOf(activeSopStage) + 1;

    const inserts = layoutCrops.map(cropId => ({
      crop_id: cropId, 
      stage_id: activeSopStage, 
      stage_sequence: currentStageSequence, // Saves the execution order to the DB
      visit_iteration: sopForm.visitIteration,
      parameter_id: sopForm.paramId,
      sequence_order: nextSeqOrder, // Auto-generated task order
      is_mandatory: sopForm.isMandatory
    }));

    const { error } = await db.from('crop_stage_parameter_layout').insert(inserts);

    if (error) return toast({ title: "Error", description: error.message, variant: "destructive" });
    toast({ title: "Added to SOP", description: `Task added to Visit ${sopForm.visitIteration} for ${layoutCrops.length} crop(s)!` });
    
    setSopForm({ ...sopForm, paramId: '' }); // Reset param field, keep visit number
    fetchLayoutMatrix();
  };

  const handleRemoveFromSOP = async (layoutId: string) => {
    const matrixItem = layoutMatrix.find(m => m.id === layoutId);
    if (!matrixItem) return;

    const { error } = await db.from('crop_stage_parameter_layout')
      .delete()
      .in('crop_id', layoutCrops)
      .eq('stage_id', matrixItem.stage_id)
      .eq('visit_iteration', matrixItem.visit_iteration)
      .eq('parameter_id', matrixItem.parameter_id);

    if (!error) {
      toast({ title: "Removed", description: "Task removed from SOP" });
      fetchLayoutMatrix();
    }
  };

  // Helper to group current stage's matrix by Visit Iteration
  const activeStageMatrix = layoutMatrix.filter(m => m.stage_id === activeSopStage);
  const visitsInStage = Array.from(new Set(activeStageMatrix.map(m => m.visit_iteration))).sort((a, b) => a - b);

  return (
    <AppLayout onLogout={onLogout}>
      <div className="flex flex-col gap-6 animate-in fade-in duration-300 pb-20">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Farm Diary Configuration</h2>
          <p className="text-muted-foreground">Manage decoupled master repositories and dynamic crop-stage layouts.</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-5 mb-4 h-12">
            <TabsTrigger value="crops" className="gap-2"><Leaf className="h-4 w-4"/> Crops</TabsTrigger>
            <TabsTrigger value="stages" className="gap-2"><ListTree className="h-4 w-4"/> Stages</TabsTrigger>
            <TabsTrigger value="uom" className="gap-2"><Ruler className="h-4 w-4"/> UOMs</TabsTrigger>
            <TabsTrigger value="parameters" className="gap-2"><Settings className="h-4 w-4"/> Parameters</TabsTrigger>
            <TabsTrigger value="layout" className="gap-2"><Map className="h-4 w-4"/> Lifecycle SOP Builder</TabsTrigger>
          </TabsList>

          {/* ... (CROPS, STAGES, UOMS, PARAMETERS TABS REMAIN UNCHANGED - COLLAPSED FOR BREVITY) ... */}
          <TabsContent value="crops">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between bg-muted/20 border-b pb-4">
                <div><CardTitle>Master of Crops</CardTitle><CardDescription>Global registry of supported crops and their categories.</CardDescription></div>
                <Dialog open={isCropOpen} onOpenChange={(o) => { setIsCropOpen(o); if(!o) setIsAddingNewCategory(false); }}>
                  <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-2"/> Add Crop</Button></DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Add New Crop</DialogTitle></DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2"><Label>Crop Name *</Label><Input placeholder="e.g. Tomato" value={newCrop.name} onChange={e => setNewCrop({...newCrop, name: e.target.value})} /></div>
                      <div className="space-y-2">
                        <Label>Crop Category *</Label>
                        {isAddingNewCategory || uniqueCategories.length === 0 ? (
                          <Input autoFocus placeholder="Type new category (e.g. Vegetable)" value={newCrop.category} onChange={e => setNewCrop({...newCrop, category: e.target.value})} />
                        ) : (
                          <Select value={newCrop.category} onValueChange={v => { if (v === 'CREATE_NEW') { setIsAddingNewCategory(true); setNewCrop({...newCrop, category: ''}); } else { setNewCrop({...newCrop, category: v}); } }}>
                            <SelectTrigger><SelectValue placeholder="Select existing category..." /></SelectTrigger>
                            <SelectContent>
                              {uniqueCategories.map(c => <SelectItem key={c as string} value={c as string}>{c as string}</SelectItem>)}
                              <SelectItem value="CREATE_NEW" className="text-primary font-semibold">+ Create New Category</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                        {isAddingNewCategory && uniqueCategories.length > 0 && <p className="text-xs text-muted-foreground cursor-pointer hover:underline" onClick={() => setIsAddingNewCategory(false)}>← Back to list</p>}
                      </div>
                    </div>
                    <DialogFooter><Button onClick={handleAddCrop}>Save Crop</Button></DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader><TableRow><TableHead className="pl-6">Crop Name</TableHead><TableHead>Category</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {crops.length === 0 && <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground py-8">No crops defined yet.</TableCell></TableRow>}
                    {crops.map(c => (<TableRow key={c.id}><TableCell className="font-medium pl-6">{c.crop_name}</TableCell><TableCell><Badge variant="outline" className="bg-slate-50">{c.crop_category}</Badge></TableCell></TableRow>))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="stages">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between bg-muted/20 border-b pb-4">
                <div><CardTitle>Master of Crop Stages</CardTitle><CardDescription>Developmental milestones for crops.</CardDescription></div>
                <Dialog open={isStageOpen} onOpenChange={setIsStageOpen}>
                  <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-2"/> Add Stage</Button></DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Add New Stage</DialogTitle></DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2"><Label>Stage Name *</Label><Input placeholder="e.g. Flowering" value={newStage.name} onChange={e => setNewStage({ name: e.target.value})} /></div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 p-2 rounded-md"><AlertCircle className="h-4 w-4 shrink-0" />Stage code will be auto-generated.</div>
                    </div>
                    <DialogFooter><Button onClick={handleAddStage}>Save Stage</Button></DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader><TableRow><TableHead className="pl-6">Stage Name</TableHead><TableHead>Auto-Generated Code</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {stages.length === 0 && <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground py-8">No stages defined yet.</TableCell></TableRow>}
                    {stages.map(s => (<TableRow key={s.id}><TableCell className="font-medium pl-6">{s.stage_name}</TableCell><TableCell><Badge variant="secondary" className="font-mono">{s.stage_code}</Badge></TableCell></TableRow>))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="uom">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between bg-muted/20 border-b pb-4">
                <div><CardTitle>Units of Measurement (UOM)</CardTitle><CardDescription>Global registry of measurement units.</CardDescription></div>
                <Dialog open={isUomOpen} onOpenChange={setIsUomOpen}>
                  <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-2"/> Add UOM</Button></DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Add New UOM</DialogTitle></DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2"><Label>UOM Name *</Label><Input placeholder="e.g. Centimeters" value={newUom.name} onChange={e => setNewUom({...newUom, name: e.target.value})} /></div>
                      <div className="space-y-2"><Label>Symbol *</Label><Input placeholder="e.g. cm" value={newUom.symbol} onChange={e => setNewUom({...newUom, symbol: e.target.value})} /></div>
                    </div>
                    <DialogFooter><Button onClick={handleAddUom}>Save UOM</Button></DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader><TableRow><TableHead className="pl-6">UOM Name</TableHead><TableHead>Symbol</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {uoms.length === 0 && <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground py-8">No UOMs defined yet.</TableCell></TableRow>}
                    {uoms.map(u => (<TableRow key={u.id}><TableCell className="font-medium pl-6">{u.uom_name}</TableCell><TableCell><Badge variant="outline" className="font-mono font-bold bg-slate-50">{u.uom_symbol}</Badge></TableCell></TableRow>))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="parameters">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between bg-muted/20 border-b pb-4">
                <div>
                  <CardTitle>Master Parameter Registry</CardTitle>
                  <CardDescription>Central pool of parameters mapped to multiple UOMs.</CardDescription>
                </div>
                <Dialog open={isParamOpen} onOpenChange={setIsParamOpen}>
                  <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-2"/> Add Parameter</Button></DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Add New Parameter</DialogTitle></DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2"><Label>Parameter Label *</Label><Input placeholder="e.g. Plant Height" value={newParam.label} onChange={e => setNewParam({...newParam, label: e.target.value})} /></div>
                      <div className="space-y-2">
                        <Label>Input Type *</Label>
                        <Select value={newParam.type} onValueChange={v => setNewParam({...newParam, type: v})}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Numeric">Numeric (Numbers only)</SelectItem>
                            <SelectItem value="Dropdown Choice">Dropdown Choice</SelectItem>
                            <SelectItem value="Boolean">Boolean (Yes/No)</SelectItem>
                            <SelectItem value="Textarea">Textarea (Long text)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {newParam.type === 'Dropdown Choice' && (
                        <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                          <Label>Dropdown Options *</Label>
                          <Input placeholder="e.g. Dark Green, Light Green, Yellow" value={newParam.options} onChange={e => setNewParam({...newParam, options: e.target.value})} />
                          <p className="text-xs text-muted-foreground">Separate options with commas.</p>
                        </div>
                      )}
                    </div>
                    <DialogFooter><Button onClick={handleAddParameter}>Save Parameter</Button></DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader><TableRow><TableHead className="pl-6">Label</TableHead><TableHead>Input Type</TableHead><TableHead>Options</TableHead><TableHead className="text-right pr-6">Actions</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {parameters.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No parameters defined yet.</TableCell></TableRow>}
                    {parameters.map(p => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium pl-6">{p.parameter_label}</TableCell>
                        <TableCell><Badge variant="secondary">{p.ui_input_type}</Badge></TableCell>
                        <TableCell className="text-muted-foreground text-xs">{p.ui_input_type === 'Dropdown Choice' ? JSON.stringify(p.options_data) : '—'}</TableCell>
                        <TableCell className="text-right pr-6">
                          {p.ui_input_type === 'Numeric' && (
                            <Button onClick={() => openUomMapping(p)} variant="outline" size="sm" className="text-primary text-xs h-7">Map UOMs</Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>


          {/* ==================== 🚀 THE NEW LIFECYCLE SOP BUILDER ==================== */}
          <TabsContent value="layout">
            <Card className="border-primary/50 shadow-md">
              <CardHeader className="bg-primary/5 border-b pb-4">
                <CardTitle className="flex items-center gap-2 text-primary">
                  <Map className="h-5 w-5" /> Lifecycle SOP Builder
                </CardTitle>
                <CardDescription>
                  Map out the entire journey of a crop. Select crops, set the chronological stage order, and define exact checklist tasks.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                  
                  {/* STEP 1: CROPS */}
                  <div className="bg-muted/20 p-5 rounded-xl border border-border/50">
                    <h3 className="font-bold text-sm text-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                      <span className="bg-primary text-white h-5 w-5 rounded-full flex items-center justify-center text-[10px]">1</span> 
                      Target Crops
                    </h3>
                    
                    <div className="space-y-4">
                      <Select value={layoutCategory} onValueChange={(v) => { setLayoutCategory(v === 'ALL' ? '' : v); setLayoutCrops([]); }}>
                        <SelectTrigger className="bg-white"><SelectValue placeholder="Filter by Category..." /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ALL">All Categories</SelectItem>
                          {uniqueCategories.map(c => <SelectItem key={c as string} value={c as string}>{c as string}</SelectItem>)}
                        </SelectContent>
                      </Select>

                      <div className="bg-white border rounded-md p-3 h-[150px] overflow-y-auto grid grid-cols-2 gap-2 shadow-inner">
                        {filteredCropsForLayout.map(c => (
                          <div key={c.id} className="flex items-center space-x-2 hover:bg-muted/50 p-1 rounded transition-colors">
                            <Checkbox id={`crop-${c.id}`} checked={layoutCrops.includes(c.id)} onCheckedChange={() => toggleLayoutCrop(c.id)} />
                            <Label htmlFor={`crop-${c.id}`} className="text-xs font-medium leading-none cursor-pointer truncate">{c.crop_name}</Label>
                          </div>
                        ))}
                        {filteredCropsForLayout.length === 0 && <p className="text-xs text-muted-foreground col-span-2 text-center mt-4">No crops found.</p>}
                      </div>
                      <div className="flex justify-between items-center text-xs text-muted-foreground">
                        <span>{layoutCrops.length} selected</span>
                        <Button variant="ghost" size="sm" onClick={selectAllFilteredCrops} className="h-6 text-[10px]">Select All</Button>
                      </div>
                    </div>
                  </div>

                  {/* STEP 2: STAGES & EXECUTION ORDER */}
                  <div className="bg-muted/20 p-5 rounded-xl border border-border/50 flex flex-col h-full">
                    <h3 className="font-bold text-sm text-foreground uppercase tracking-wider mb-2 flex items-center gap-2">
                      <span className="bg-primary text-white h-5 w-5 rounded-full flex items-center justify-center text-[10px]">2</span> 
                      Crop Journey (Execution Order)
                    </h3>
                    <p className="text-xs text-muted-foreground mb-4 leading-tight">
                      Check stages below, then use the arrows to set their chronological order. This defines what the mobile app shows first!
                    </p>
                    
                    <div className="flex-1 grid grid-cols-2 gap-4">
                      {/* Selection Box */}
                      <div className="bg-white border rounded-md p-3 h-[150px] overflow-y-auto flex flex-col gap-2 shadow-inner">
                        <Label className="text-[10px] font-bold text-muted-foreground uppercase">Available Stages</Label>
                        {stages.map(s => (
                          <div key={s.id} className="flex items-center space-x-2 hover:bg-muted/50 p-1 rounded transition-colors">
                            <Checkbox id={`stage-${s.id}`} checked={layoutStages.includes(s.id)} onCheckedChange={() => toggleLayoutStage(s.id)} />
                            <Label htmlFor={`stage-${s.id}`} className="text-xs font-medium leading-none cursor-pointer truncate">{s.stage_name}</Label>
                          </div>
                        ))}
                      </div>

                      {/* Reordering Box */}
                      <div className="bg-slate-50 border rounded-md p-3 h-[150px] overflow-y-auto flex flex-col gap-2">
                        <Label className="text-[10px] font-bold text-muted-foreground uppercase text-center mb-1">Execution Sequence</Label>
                        {layoutStages.length === 0 ? (
                          <p className="text-xs text-muted-foreground text-center mt-4 italic">No stages selected.</p>
                        ) : (
                          layoutStages.map((stageId, index) => {
                            const stage = stages.find(s => s.id === stageId);
                            return (
                              <div key={stageId} className="flex items-center justify-between bg-white border p-1.5 rounded shadow-sm text-xs">
                                <span className="font-medium truncate"><span className="text-muted-foreground mr-1">{index + 1}.</span> {stage?.stage_name}</span>
                                <div className="flex gap-0.5">
                                  <Button size="icon" variant="ghost" className="h-5 w-5" disabled={index === 0} onClick={() => moveStageUp(index)}><ChevronUp className="h-3 w-3" /></Button>
                                  <Button size="icon" variant="ghost" className="h-5 w-5" disabled={index === layoutStages.length - 1} onClick={() => moveStageDown(index)}><ChevronDown className="h-3 w-3" /></Button>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* STEP 3: WORKSPACE */}
                {layoutCrops.length > 0 && layoutStages.length > 0 ? (
                  <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 border-t pt-8 mt-4">
                    <h3 className="font-bold text-lg text-foreground mb-4 flex items-center gap-2">
                      <span className="bg-primary text-white h-6 w-6 rounded-full flex items-center justify-center text-xs">3</span> 
                      Parameter SOP Configuration
                    </h3>

                    <Tabs value={activeSopStage} onValueChange={setActiveSopStage} className="w-full">
                      {/* Tabs mapped in exact order defined by the user */}
                      <TabsList className="w-full justify-start h-auto flex-wrap bg-muted/50 p-1 gap-1">
                        {layoutStages.map((stageId, index) => {
                          const stage = stages.find(s => s.id === stageId);
                          return (
                            <TabsTrigger key={stageId} value={stageId} className="data-[state=active]:bg-white data-[state=active]:shadow-sm">
                              {index + 1}. {stage?.stage_name}
                            </TabsTrigger>
                          );
                        })}
                      </TabsList>

                      {layoutStages.map(stageId => {
                        const stage = stages.find(s => s.id === stageId);
                        if (activeSopStage !== stageId) return null;

                        return (
                          <TabsContent key={stageId} value={stageId} className="mt-4 outline-none">
                            <div className="bg-slate-50 border rounded-xl p-4 shadow-sm">
                              
                              {/* SOP Parameter Adder (Order input hidden!) */}
                              <div className="bg-white border rounded-lg p-4 shadow-sm mb-6">
                                <h4 className="text-sm font-bold text-primary mb-3">Add Task to {stage?.stage_name}</h4>
                                <div className="flex flex-wrap items-end gap-4">
                                  <div className="w-[120px] space-y-1.5">
                                    <Label className="text-xs font-bold text-muted-foreground uppercase">Visit No.</Label>
                                    <Input type="number" min="1" value={sopForm.visitIteration} onChange={e => setSopForm({...sopForm, visitIteration: parseInt(e.target.value) || 1})} />
                                  </div>
                                  <div className="flex-1 min-w-[250px] space-y-1.5">
                                    <Label className="text-xs font-bold text-muted-foreground uppercase">Parameter to Measure</Label>
                                    <Select value={sopForm.paramId} onValueChange={v => setSopForm({...sopForm, paramId: v})}>
                                      <SelectTrigger><SelectValue placeholder="Choose parameter..." /></SelectTrigger>
                                      <SelectContent>
                                        {parameters.map(p => (
                                          <SelectItem key={p.id} value={p.id}>{p.parameter_label} <span className="text-muted-foreground ml-2 text-[10px]">({p.ui_input_type})</span></SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div className="flex items-center gap-2 mb-2 pb-1 mx-2">
                                    <Checkbox id={`mand-${stageId}`} checked={sopForm.isMandatory} onCheckedChange={(c) => setSopForm({...sopForm, isMandatory: !!c})} />
                                    <Label htmlFor={`mand-${stageId}`} className="text-xs font-bold text-muted-foreground uppercase cursor-pointer">Required</Label>
                                  </div>
                                  <Button onClick={handleAddParamToSOP} className="gap-2"><Plus className="h-4 w-4" /> Add Task to Visit {sopForm.visitIteration}</Button>
                                </div>
                              </div>

                              {/* Grouped Table by Visits */}
                              {activeStageMatrix.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground italic bg-white border rounded-lg">
                                  No checklist tasks configured for {stage?.stage_name} yet.
                                </div>
                              ) : (
                                <div className="space-y-4">
                                  {visitsInStage.map(visitNum => {
                                    const visitParams = activeStageMatrix.filter(m => m.visit_iteration === visitNum);
                                    return (
                                      <div key={visitNum} className="bg-white border rounded-lg overflow-hidden shadow-sm">
                                        <div className="bg-muted/30 px-4 py-2 border-b">
                                          <h5 className="font-bold text-sm text-foreground">Visit {visitNum} Checklist Tasks</h5>
                                        </div>
                                        <Table>
                                          <TableHeader>
                                            <TableRow>
                                              <TableHead className="w-[80px] text-center">Auto-Order</TableHead>
                                              <TableHead>Parameter to Measure</TableHead>
                                              <TableHead>Input Type</TableHead>
                                              <TableHead className="text-center">Mandatory</TableHead>
                                              <TableHead className="text-right">Action</TableHead>
                                            </TableRow>
                                          </TableHeader>
                                          <TableBody>
                                            {visitParams.map(m => (
                                              <TableRow key={m.id}>
                                                <TableCell className="text-center font-bold text-muted-foreground">{m.sequence_order}</TableCell>
                                                <TableCell className="font-semibold">{m.master_parameters?.parameter_label}</TableCell>
                                                <TableCell><Badge variant="secondary" className="text-[10px]">{m.master_parameters?.ui_input_type}</Badge></TableCell>
                                                <TableCell className="text-center">{m.is_mandatory ? <Badge className="bg-amber-100 text-amber-800">Yes</Badge> : <Badge variant="outline">No</Badge>}</TableCell>
                                                <TableCell className="text-right"><Button variant="ghost" size="icon" onClick={() => handleRemoveFromSOP(m.id)} className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"><Trash2 className="h-4 w-4" /></Button></TableCell>
                                              </TableRow>
                                            ))}
                                          </TableBody>
                                        </Table>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </TabsContent>
                        );
                      })}
                    </Tabs>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 text-center bg-muted/20 border border-dashed rounded-lg mt-8">
                    <CheckSquare className="h-12 w-12 text-muted-foreground mb-4 opacity-30" />
                    <h3 className="text-lg font-bold text-muted-foreground">Setup SOP Workflow</h3>
                    <p className="text-sm text-muted-foreground/70 max-w-sm mt-1">
                      Complete Step 1 (Select Crops) and Step 2 (Select & Order Stages) to unlock the checklist builder.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* UOM MAPPING DIALOG */}
      <Dialog open={isMapUomOpen} onOpenChange={setIsMapUomOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Map Units of Measurement</DialogTitle>
            <DialogDescription>Select valid UOMs for <strong className="text-foreground">{activeParam?.parameter_label}</strong></DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="border rounded-md p-4 bg-muted/20 space-y-3">
              <Label className="text-xs font-bold uppercase text-muted-foreground tracking-wider mb-2 block">1. Select Allowed UOMs</Label>
              <div className="grid grid-cols-2 gap-3 max-h-[200px] overflow-y-auto">
                {uoms.map(u => (
                  <div key={u.id} className="flex items-center space-x-2">
                    <Checkbox id={`uom-${u.id}`} checked={selectedUoms.includes(u.id)} onCheckedChange={() => toggleUomSelection(u.id)} />
                    <Label htmlFor={`uom-${u.id}`} className="text-sm font-medium leading-none cursor-pointer">{u.uom_name} ({u.uom_symbol})</Label>
                  </div>
                ))}
              </div>
            </div>

            {selectedUoms.length > 0 && (
              <div className="space-y-2 animate-in fade-in duration-300">
                <Label className="text-xs font-bold uppercase text-muted-foreground tracking-wider block">2. Select Default Layout Choice</Label>
                <Select value={defaultUom} onValueChange={setDefaultUom}>
                  <SelectTrigger><SelectValue placeholder="Select default UOM..." /></SelectTrigger>
                  <SelectContent>
                    {uoms.filter(u => selectedUoms.includes(u.id)).map(u => (
                      <SelectItem key={u.id} value={u.id}>{u.uom_name} ({u.uom_symbol})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">This is the unit the mobile app will select by default on the field.</p>
              </div>
            )}
          </div>
          <DialogFooter><Button onClick={saveUomMapping}>Save Mappings</Button></DialogFooter>
        </DialogContent>
      </Dialog>
 
    </AppLayout>
  );
}

