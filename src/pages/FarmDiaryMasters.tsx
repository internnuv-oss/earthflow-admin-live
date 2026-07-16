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
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Plus, Settings, Ruler, Leaf, ListTree, AlertCircle, Trash2, Map, FlaskConical, Save, CheckSquare, Table2, ChevronUp, ChevronDown, Eye } from 'lucide-react';

export default function FarmDiaryMasters({ onLogout }: { onLogout: () => void }) {
  const { toast } = useToast();
  // 🚀 FIXED: Default tab is now 'crops'
  const [activeTab, setActiveTab] = useState('crops'); 
  const [loading, setLoading] = useState(false);
  
  // Master Data States
  const [crops, setCrops] = useState<any[]>([]);
  const [stages, setStages] = useState<any[]>([]);
  const [uoms, setUoms] = useState<any[]>([]);
  const [parameters, setParameters] = useState<any[]>([]);
  const [glsProducts, setGlsProducts] = useState<any[]>([]); 
  const [appTypes, setAppTypes] = useState<string[]>(['Spray', 'Drench', 'Broadcasting', 'Basal Dose', 'Seed Treatment', 'Foliar']);
  
  // SPREADSHEET BUILDER STATES
  const [layoutCategory, setLayoutCategory] = useState<string>('');
  const [layoutCrops, setLayoutCrops] = useState<string[]>([]);
  const [layoutStages, setLayoutStages] = useState<string[]>([]); 
  const [activeSopStage, setActiveSopStage] = useState<string>('');
  
  // Interactive Form States
  const [applications, setApplications] = useState<any[]>([]);
  const [recommendation, setRecommendation] = useState('');
  const [selectedParams, setSelectedParams] = useState<any[]>([]);
  const [savingSop, setSavingSop] = useState(false);

  // Modal States
  const [isCropOpen, setIsCropOpen] = useState(false);
  const [isStageOpen, setIsStageOpen] = useState(false);
  const [isUomOpen, setIsUomOpen] = useState(false);
  const [isParamOpen, setIsParamOpen] = useState(false);
  const [isGlsOpen, setIsGlsOpen] = useState(false);
  const [isMapUomOpen, setIsMapUomOpen] = useState(false);

  // 🚀 NEW: Crop SOP Viewer States
  const [isSopViewOpen, setIsSopViewOpen] = useState(false);
  const [viewCrop, setViewCrop] = useState<any>(null);
  const [viewSopData, setViewSopData] = useState<any[]>([]);
  const [loadingViewSop, setLoadingViewSop] = useState(false);

  // UOM Mapping States
  const [activeParam, setActiveParam] = useState<any>(null);
  const [selectedUoms, setSelectedUoms] = useState<string[]>([]);
  const [defaultUom, setDefaultUom] = useState<string>('');

  // Form States for Masters
  const [newCrop, setNewCrop] = useState({ name: '', category: '' });
  const [isAddingNewCategory, setIsAddingNewCategory] = useState(false);
  const [newStage, setNewStage] = useState({ name: '' });
  const [newUom, setNewUom] = useState({ name: '', symbol: '' });
  const [newParam, setNewParam] = useState({ label: '', type: 'Numeric', options: '' });
  const [newGls, setNewGls] = useState({ name: '', ingredients: '' });

  const db = supabase as any;

  useEffect(() => { fetchMasters(); }, []);

  useEffect(() => {
    if (layoutStages.length > 0 && (!activeSopStage || !layoutStages.includes(activeSopStage))) {
      setActiveSopStage(layoutStages[0]);
    }
  }, [layoutStages]);

  useEffect(() => {
    if (layoutCrops.length === 1 && activeSopStage) {
      loadExistingSOP(layoutCrops[0], activeSopStage);
    } else {
      setApplications([]);
      setRecommendation('');
      setSelectedParams([]);
    }
  }, [layoutCrops, activeSopStage]);

  const fetchMasters = async () => {
    setLoading(true);
    const [cropsRes, stagesRes, uomRes, paramsRes, glsRes] = await Promise.all([
      db.from('master_crops').select('*').order('crop_name'),
      db.from('master_crop_stages').select('*').order('stage_name'),
      db.from('master_uom').select('*').order('uom_name'),
      db.from('master_parameters').select('*').order('parameter_label'),
      db.from('master_gls_products').select('*').order('product_name')
    ]);

    if (cropsRes.data) setCrops(cropsRes.data);
    if (stagesRes.data) setStages(stagesRes.data);
    if (uomRes.data) setUoms(uomRes.data);
    if (paramsRes.data) setParameters(paramsRes.data);
    if (glsRes.data) setGlsProducts(glsRes.data);
    setLoading(false);
  };

  const loadExistingSOP = async (cropId: string, stageId: string) => {
    setLoading(true);
    const { data: parentData } = await db.from('sop_crop_stages')
      .select('*').eq('crop_id', cropId).eq('stage_id', stageId).maybeSingle();

    if (parentData) {
      setRecommendation(parentData.chemical_recommendation_and_dosage || '');
      const { data: appData } = await db.from('sop_applications')
        .select('*').eq('sop_crop_stage_id', parentData.id).order('das', { ascending: true });
      
      if (appData) {
        const existingTypes = appData.map((a: any) => a.application_type).filter(Boolean);
        setAppTypes(prev => Array.from(new Set([...prev, ...existingTypes])));
        setApplications(appData);
      } else setApplications([]);

      const { data: paramData } = await db.from('sop_parameters')
        .select('*').eq('sop_crop_stage_id', parentData.id);
      setSelectedParams(paramData || []);
    } else {
      setApplications([]);
      setRecommendation('');
      setSelectedParams([]);
    }
    setLoading(false);
  };

  // 🚀 NEW: Fetch the Entire Format.xlsx style table for a specific crop
  const handleViewCropSop = async (crop: any) => {
    setViewCrop(crop);
    setIsSopViewOpen(true);
    setLoadingViewSop(true);

    const { data, error } = await db.from('sop_crop_stages')
      .select(`
        id, stage_sequence, chemical_recommendation_and_dosage,
        master_crop_stages ( stage_name ),
        sop_applications ( 
          id, application_type, das, application_method, dosage_value, benefit, impact, recommendation, chemical_name, chemical_dosage,
          master_gls_products ( product_name )
        ),
        sop_parameters ( 
          is_mandatory, 
          master_parameters ( parameter_label ) 
        )
      `)
      .eq('crop_id', crop.id)
      .order('stage_sequence', { ascending: true });

    if (error) {
      toast({ title: 'Error fetching SOP', description: error.message, variant: 'destructive' });
    } else if (data) {
      // Sort applications chronologically by DAS
      const formattedData = data.map((stage: any) => {
        stage.sop_applications.sort((a: any, b: any) => Number(a.das) - Number(b.das));
        return stage;
      });
      setViewSopData(formattedData);
    }
    setLoadingViewSop(false);
  };

  const uniqueCategories = Array.from(new Set(crops.map(c => c.crop_category).filter(Boolean)));
  const filteredCropsForLayout = crops.filter(c => layoutCategory ? c.crop_category === layoutCategory : true);

  const toggleLayoutCrop = (cropId: string) => { setLayoutCrops(prev => prev.includes(cropId) ? prev.filter(id => id !== cropId) : [...prev, cropId]); };
  const toggleLayoutStage = (stageId: string) => { setLayoutStages(prev => prev.includes(stageId) ? prev.filter(id => id !== stageId) : [...prev, stageId]); };
  const selectAllFilteredCrops = () => setLayoutCrops(filteredCropsForLayout.map(c => c.id));

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

  const saveExecutionOrder = async () => {
    if (layoutCrops.length === 0 || layoutStages.length === 0) return;
    setLoading(true);
    try {
      for (const cropId of layoutCrops) {
        for (let i = 0; i < layoutStages.length; i++) {
          const stageId = layoutStages[i];
          const seq = i + 1;
          const { data: existing } = await db.from('sop_crop_stages').select('id').eq('crop_id', cropId).eq('stage_id', stageId).maybeSingle();
          if (existing) {
             await db.from('sop_crop_stages').update({ stage_sequence: seq }).eq('id', existing.id);
          } else {
             await db.from('sop_crop_stages').insert({ crop_id: cropId, stage_id: stageId, stage_sequence: seq });
          }
        }
      }
      toast({ title: "Order Saved", description: "Global stage sequence locked in." });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
    setLoading(false);
  };

  const handleAddCrop = async () => {
    if (!newCrop.name.trim() || !newCrop.category.trim()) return toast({ title: "Error", description: "Required", variant: "destructive" });
    await db.from('master_crops').insert([{ crop_name: newCrop.name.trim(), crop_category: newCrop.category.trim(), status: 'Active' }]);
    setIsCropOpen(false); setNewCrop({ name: '', category: '' }); fetchMasters();
  };
  const handleAddStage = async () => {
    if (!newStage.name.trim()) return toast({ title: "Error", description: "Required", variant: "destructive" });
    await db.from('master_crop_stages').insert([{ stage_name: newStage.name.trim(), stage_code: newStage.name.substring(0,3).toUpperCase() }]);
    setIsStageOpen(false); setNewStage({ name: '' }); fetchMasters();
  };
  const handleAddUom = async () => {
    if (!newUom.name.trim() || !newUom.symbol.trim()) return toast({ title: "Error", description: "Required", variant: "destructive" });
    await db.from('master_uom').insert([{ uom_name: newUom.name.trim(), uom_symbol: newUom.symbol.trim() }]);
    setIsUomOpen(false); setNewUom({ name: '', symbol: '' }); fetchMasters();
  };
  const handleAddParameter = async () => {
    if (!newParam.label.trim()) return toast({ title: "Error", description: "Required", variant: "destructive" });
    let options = newParam.type === 'Dropdown Choice' ? newParam.options.split(',').map(s=>s.trim()).filter(Boolean) : [];
    await db.from('master_parameters').insert([{ parameter_label: newParam.label.trim(), ui_input_type: newParam.type, options_data: options }]);
    setIsParamOpen(false); setNewParam({ label: '', type: 'Numeric', options: '' }); fetchMasters();
  };
  
  const handleAddGls = async () => {
    if (!newGls.name.trim()) return toast({ title: "Error", description: "Product Name is required", variant: "destructive" });
    setLoading(true);
    const { error } = await db.from('master_gls_products').insert([{ product_name: newGls.name.trim(), active_ingredients: newGls.ingredients.trim() }]);
    setLoading(false);
    if (error) return toast({ title: "Save Failed", description: error.message, variant: "destructive" });
    toast({ title: "Success", description: "GLS Product added!" });
    setIsGlsOpen(false); setNewGls({ name: '', ingredients: '' }); fetchMasters();
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
      await db.from('parameter_uom_mapping').insert(inserts);
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

  const addApplicationRow = () => {
    setApplications([...applications, { 
      tempId: Date.now(), application_type: '', _isCustomAppType: false, das: '', application_method: '', gls_product_id: 'NONE', dosage_value: '', 
      benefit: '', impact: '', recommendation: '', chemical_name: '', chemical_dosage: '' 
    }]);
  };
  const updateAppRow = (index: number, field: string, value: any) => { const newApps = [...applications]; newApps[index][field] = value; setApplications(newApps); };
  const removeAppRow = (index: number) => { setApplications(applications.filter((_, i) => i !== index)); };
  
  const addParamRow = () => { setSelectedParams([...selectedParams, { tempId: Date.now(), parameter_id: '', is_mandatory: false }]); };
  const updateParamRow = (index: number, field: string, value: any) => { const newParams = [...selectedParams]; newParams[index][field] = value; setSelectedParams(newParams); };
  const removeParamRow = (index: number) => { setSelectedParams(selectedParams.filter((_, i) => i !== index)); };

  const saveActiveStageSop = async () => {
    if (layoutCrops.length === 0 || !activeSopStage) return toast({ title: "Error", description: "Select crop and stage.", variant: "destructive" });
    const hasEmptyDas = applications.some(a => a.das === '' || a.das === null);
    if (hasEmptyDas) return toast({ title: "Error", description: "DAS is required for all applications.", variant: "destructive" });

    setSavingSop(true);

    try {
      const stageSeq = layoutStages.indexOf(activeSopStage) + 1;

      for (const cropId of layoutCrops) {
        let parentId;
        const { data: existingParent } = await db.from('sop_crop_stages').select('id').eq('crop_id', cropId).eq('stage_id', activeSopStage).maybeSingle();

        if (existingParent) {
          parentId = existingParent.id;
          await db.from('sop_crop_stages').update({ stage_sequence: stageSeq, chemical_recommendation_and_dosage: recommendation }).eq('id', parentId);
        } else {
          const { data: newParent, error: pErr } = await db.from('sop_crop_stages')
            .insert([{ crop_id: cropId, stage_id: activeSopStage, stage_sequence: stageSeq, chemical_recommendation_and_dosage: recommendation }])
            .select('id').single();
          if (pErr) throw pErr;
          parentId = newParent.id;
        }

        await db.from('sop_applications').delete().eq('sop_crop_stage_id', parentId);
        await db.from('sop_parameters').delete().eq('sop_crop_stage_id', parentId);

        if (applications.length > 0) {
          const appInserts = applications.map(a => ({
            sop_crop_stage_id: parentId,
            application_type: a.application_type || null,
            das: Number(a.das),
            application_method: a.application_method || null,
            gls_product_id: a.gls_product_id === 'NONE' || !a.gls_product_id ? null : a.gls_product_id,
            dosage_value: a.dosage_value || null,
            benefit: a.benefit || null,
            impact: a.impact || null,
            recommendation: a.recommendation || null,
            chemical_name: a.chemical_name || null,
            chemical_dosage: a.chemical_dosage || null
          }));
          const { error: aErr } = await db.from('sop_applications').insert(appInserts);
          if (aErr) throw aErr;
        }

        if (selectedParams.length > 0) {
          const uniqueParams = Array.from(new Set(selectedParams.map(p => p.parameter_id)))
            .map(id => selectedParams.find(p => p.parameter_id === id));
          
          const paramInserts = uniqueParams.map(p => ({
            sop_crop_stage_id: parentId,
            parameter_id: p.parameter_id,
            is_mandatory: p.is_mandatory
          }));
          const { error: prErr } = await db.from('sop_parameters').insert(paramInserts);
          if (prErr) throw prErr;
        }
      }

      toast({ title: "Success!", description: `Stage SOP saved for ${layoutCrops.length} crop(s).` });
      if (layoutCrops.length === 1) loadExistingSOP(layoutCrops[0], activeSopStage);
      
    } catch (err: any) {
      toast({ title: "Save Failed", description: err.message, variant: "destructive" });
    }
    setSavingSop(false);
  };

  return (
    <AppLayout onLogout={onLogout}>
      <div className="flex flex-col gap-6 animate-in fade-in duration-300 pb-20">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Farm Diary Configuration</h2>
          <p className="text-muted-foreground">Manage decoupled master repositories and dynamic crop schedules.</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          {/* 🚀 FIXED: Reordered Tabs, Builder is now LAST */}
          <TabsList className="grid grid-cols-6 mb-4 h-12">
            <TabsTrigger value="crops" className="gap-2"><Leaf className="h-4 w-4"/> Crops</TabsTrigger>
            <TabsTrigger value="stages" className="gap-2"><ListTree className="h-4 w-4"/> Stages</TabsTrigger>
            <TabsTrigger value="gls" className="gap-2"><FlaskConical className="h-4 w-4"/> GLS</TabsTrigger>
            <TabsTrigger value="parameters" className="gap-2"><Settings className="h-4 w-4"/> Params</TabsTrigger>
            <TabsTrigger value="uom" className="gap-2"><Ruler className="h-4 w-4"/> UOMs</TabsTrigger>
            <TabsTrigger value="layout" className="gap-2"><Map className="h-4 w-4"/> SOP Builder</TabsTrigger>
          </TabsList>

          {/* ==================== 🚀 CROPS TAB (NOW FIRST) ==================== */}
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
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-6">Crop Name</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right pr-6">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {crops.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-8">No crops defined yet.</TableCell></TableRow>}
                    {crops.map(c => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium pl-6">{c.crop_name}</TableCell>
                        <TableCell><Badge variant="outline" className="bg-slate-50">{c.crop_category}</Badge></TableCell>
                        <TableCell className="text-right pr-6">
                          <Button variant="outline" size="sm" onClick={() => handleViewCropSop(c)} className="h-8 text-xs text-primary border-primary/20 hover:bg-primary/10">
                            <Eye className="h-3 w-3 mr-2" /> View SOP Format
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ... OTHER MASTER TABS (UNCHANGED) ... */}
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

          <TabsContent value="gls">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between bg-muted/20 border-b pb-4">
                <div><CardTitle>Master of Products</CardTitle><CardDescription>Registry of products used in applications.</CardDescription></div>
                <Dialog open={isGlsOpen} onOpenChange={setIsGlsOpen}>
                  <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-2"/> Add Product</Button></DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Add New Product</DialogTitle></DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2"><Label>Product Name *</Label><Input value={newGls.name} onChange={e => setNewGls({...newGls, name: e.target.value})} /></div>
                      <div className="space-y-2"><Label>Active Ingredients</Label><Input placeholder="e.g., Nitrogen 20%" value={newGls.ingredients} onChange={e => setNewGls({...newGls, ingredients: e.target.value})} /></div>
                    </div>
                    <DialogFooter><Button onClick={handleAddGls}>Save Product</Button></DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader><TableRow><TableHead className="pl-6">Product Name</TableHead><TableHead>Active Ingredients</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {glsProducts.length === 0 && <TableRow><TableCell colSpan={2} className="text-center py-8">No products yet.</TableCell></TableRow>}
                    {glsProducts.map(g => (<TableRow key={g.id}><TableCell className="font-medium pl-6">{g.product_name}</TableCell><TableCell className="text-muted-foreground">{g.active_ingredients || '--'}</TableCell></TableRow>))}
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
                        <div className="space-y-2">
                          <Label>Dropdown Options *</Label>
                          <Input placeholder="e.g. Dark Green, Light Green, Yellow" value={newParam.options} onChange={e => setNewParam({...newParam, options: e.target.value})} />
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
                    {parameters.length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-8">No parameters defined yet.</TableCell></TableRow>}
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
                    {uoms.length === 0 && <TableRow><TableCell colSpan={2} className="text-center py-8">No UOMs defined yet.</TableCell></TableRow>}
                    {uoms.map(u => (<TableRow key={u.id}><TableCell className="font-medium pl-6">{u.uom_name}</TableCell><TableCell><Badge variant="outline" className="font-mono font-bold bg-slate-50">{u.uom_symbol}</Badge></TableCell></TableRow>))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ==================== 🚀 SPREADSHEET SOP BUILDER (NOW LAST) ==================== */}
          <TabsContent value="layout">
            <div className="grid grid-cols-1 gap-6">
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-4">
                <div className="bg-muted/20 p-5 rounded-xl border border-border/50">
                  <h3 className="font-bold text-sm text-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                    <span className="bg-primary text-white h-5 w-5 rounded-full flex items-center justify-center text-[10px]">1</span> Target Crops
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
                        <div key={c.id} className="flex items-center space-x-2 hover:bg-muted/50 p-1 rounded">
                          <Checkbox id={`crop-${c.id}`} checked={layoutCrops.includes(c.id)} onCheckedChange={() => toggleLayoutCrop(c.id)} />
                          <Label htmlFor={`crop-${c.id}`} className="text-xs font-medium cursor-pointer truncate">{c.crop_name}</Label>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between items-center text-xs text-muted-foreground">
                      <span>{layoutCrops.length} selected</span>
                      <Button variant="ghost" size="sm" onClick={selectAllFilteredCrops} className="h-6 text-[10px]">Select All</Button>
                    </div>
                  </div>
                </div>

                <div className="bg-muted/20 p-5 rounded-xl border border-border/50 flex flex-col h-full">
                  <h3 className="font-bold text-sm text-foreground uppercase tracking-wider mb-2 flex items-center gap-2">
                    <span className="bg-primary text-white h-5 w-5 rounded-full flex items-center justify-center text-[10px]">2</span> Crop Journey (Execution Order)
                  </h3>
                  <div className="flex-1 grid grid-cols-2 gap-4 mt-2">
                    <div className="bg-white border rounded-md p-3 h-[150px] overflow-y-auto flex flex-col gap-2 shadow-inner">
                      <Label className="text-[10px] font-bold text-muted-foreground uppercase">Available Stages</Label>
                      {stages.map(s => (
                        <div key={s.id} className="flex items-center space-x-2 p-1 rounded">
                          <Checkbox id={`stage-${s.id}`} checked={layoutStages.includes(s.id)} onCheckedChange={() => toggleLayoutStage(s.id)} />
                          <Label htmlFor={`stage-${s.id}`} className="text-xs font-medium cursor-pointer truncate">{s.stage_name}</Label>
                        </div>
                      ))}
                    </div>
                    <div className="bg-slate-50 border rounded-md p-3 h-[150px] overflow-y-auto flex flex-col gap-2">
                      <div className="flex justify-between items-center mb-1">
                        <Label className="text-[10px] font-bold text-muted-foreground uppercase text-center">Execution Sequence</Label>
                      </div>
                      {layoutStages.map((stageId, index) => {
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
                      })}
                    </div>
                  </div>
                  <Button onClick={saveExecutionOrder} variant="outline" size="sm" className="mt-4 w-full bg-white">Lock Global Stage Order</Button>
                </div>
              </div>

              {layoutCrops.length > 0 && layoutStages.length > 0 && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 border-t pt-6">
                  <h3 className="font-bold text-lg text-foreground mb-4 flex items-center gap-2">
                    <span className="bg-primary text-white h-6 w-6 rounded-full flex items-center justify-center text-xs">3</span> SOP Spreadsheet Editor
                  </h3>

                  <Tabs value={activeSopStage} onValueChange={setActiveSopStage} className="w-full">
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
                          <Card className="border-border shadow-md bg-slate-50">
                            <CardContent className="p-4 space-y-6">
                              
                              {/* SPREADSHEET TABLE */}
                              <div className="bg-white border rounded-lg shadow-sm overflow-hidden">
                                <div className="bg-muted/30 px-4 py-3 border-b flex justify-between items-center">
                                  <h4 className="text-sm font-bold flex items-center gap-2"><FlaskConical className="h-4 w-4 text-primary" /> Application Schedule</h4>
                                  <Button size="sm" onClick={addApplicationRow} className="h-7 text-xs gap-1"><Plus className="h-3 w-3"/> Add Application Row</Button>
                                </div>
                                <div className="overflow-x-auto">
                                  <Table className="min-w-[1400px]">
                                    <TableHeader className="bg-slate-50">
                                      <TableRow>
                                        <TableHead className="w-[140px]">Application</TableHead>
                                        <TableHead className="w-[80px]">DAS *</TableHead>
                                        <TableHead className="w-[200px]">Method</TableHead>
                                        <TableHead className="w-[180px]">Product</TableHead>
                                        <TableHead className="w-[120px]">Dosage / Acre</TableHead>
                                        <TableHead className="w-[200px]">Benefit</TableHead>
                                        <TableHead className="w-[200px]">Impact</TableHead>
                                        <TableHead className="w-[150px]">Recommendation</TableHead>
                                        <TableHead className="w-[150px]">Chemicals</TableHead>
                                        <TableHead className="w-[120px]">Dosage / Acre</TableHead>
                                        <TableHead className="w-[50px]"></TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {applications.length === 0 ? (
                                        <TableRow><TableCell colSpan={11} className="text-center py-6 text-muted-foreground italic text-xs">No rows defined. Click "Add Application Row".</TableCell></TableRow>
                                      ) : (
                                        applications.map((app, index) => (
                                          <TableRow key={app.id || app.tempId} className="hover:bg-transparent">
                                            <TableCell className="p-1.5">
                                              {app._isCustomAppType ? (
                                                <Input 
                                                  autoFocus
                                                  placeholder="Type & Enter" 
                                                  value={app.application_type} 
                                                  onChange={e => updateAppRow(index, 'application_type', e.target.value)}
                                                  onKeyDown={e => {
                                                    if (e.key === 'Enter') {
                                                      if (app.application_type && !appTypes.includes(app.application_type)) setAppTypes(prev => [...prev, app.application_type]);
                                                      updateAppRow(index, '_isCustomAppType', false);
                                                    }
                                                  }}
                                                  onBlur={() => {
                                                    if (app.application_type && !appTypes.includes(app.application_type)) setAppTypes(prev => [...prev, app.application_type]);
                                                    updateAppRow(index, '_isCustomAppType', false);
                                                  }}
                                                  className="h-8 text-xs bg-white border-primary" 
                                                />
                                              ) : (
                                                <Select 
                                                  value={app.application_type || ''} 
                                                  onValueChange={v => {
                                                    if (v === 'CREATE_NEW') {
                                                      updateAppRow(index, '_isCustomAppType', true);
                                                      updateAppRow(index, 'application_type', ''); 
                                                    } else updateAppRow(index, 'application_type', v);
                                                  }}
                                                >
                                                  <SelectTrigger className="h-8 text-xs bg-white"><SelectValue placeholder="Select Type..."/></SelectTrigger>
                                                  <SelectContent>
                                                    {appTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                                                    <SelectItem value="CREATE_NEW" className="text-primary font-bold">+ Create New Type</SelectItem>
                                                  </SelectContent>
                                                </Select>
                                              )}
                                            </TableCell>
                                            <TableCell className="p-1.5"><Input type="number" placeholder="0" value={app.das} onChange={e => updateAppRow(index, 'das', e.target.value)} className="h-8 text-xs bg-white border-primary/40" /></TableCell>
                                            <TableCell className="p-1.5"><Input placeholder="Method..." value={app.application_method} onChange={e => updateAppRow(index, 'application_method', e.target.value)} className="h-8 text-xs bg-white" /></TableCell>
                                            <TableCell className="p-1.5">
                                              <Select value={app.gls_product_id || 'NONE'} onValueChange={v => updateAppRow(index, 'gls_product_id', v)}>
                                                <SelectTrigger className="h-8 text-xs bg-white"><SelectValue placeholder="Select..."/></SelectTrigger>
                                                <SelectContent>
                                                  <SelectItem value="NONE" className="italic text-muted-foreground">-- None --</SelectItem>
                                                  {glsProducts.map(g => <SelectItem key={g.id} value={g.id}>{g.product_name}</SelectItem>)}
                                                </SelectContent>
                                              </Select>
                                            </TableCell>
                                            <TableCell className="p-1.5"><Input placeholder="1L/Ton" value={app.dosage_value} onChange={e => updateAppRow(index, 'dosage_value', e.target.value)} className="h-8 text-xs bg-white" /></TableCell>
                                            <TableCell className="p-1.5"><Input placeholder="Benefit..." value={app.benefit} onChange={e => updateAppRow(index, 'benefit', e.target.value)} className="h-8 text-xs bg-white" /></TableCell>
                                            <TableCell className="p-1.5"><Input placeholder="Impact..." value={app.impact} onChange={e => updateAppRow(index, 'impact', e.target.value)} className="h-8 text-xs bg-white" /></TableCell>
                                            <TableCell className="p-1.5"><Input placeholder="e.g. 1 App" value={app.recommendation} onChange={e => updateAppRow(index, 'recommendation', e.target.value)} className="h-8 text-xs bg-white" /></TableCell>
                                            <TableCell className="p-1.5"><Input placeholder="Chemicals..." value={app.chemical_name} onChange={e => updateAppRow(index, 'chemical_name', e.target.value)} className="h-8 text-xs bg-white" /></TableCell>
                                            <TableCell className="p-1.5"><Input placeholder="e.g. 1 Bag" value={app.chemical_dosage} onChange={e => updateAppRow(index, 'chemical_dosage', e.target.value)} className="h-8 text-xs bg-white" /></TableCell>
                                            <TableCell className="p-1.5 text-center">
                                              <Button variant="ghost" size="icon" onClick={() => removeAppRow(index)} className="h-7 w-7 text-red-500 hover:bg-red-50"><Trash2 className="h-3 w-3" /></Button>
                                            </TableCell>
                                          </TableRow>
                                        ))
                                      )}
                                    </TableBody>
                                  </Table>
                                </div>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* PART B: RECOMMENDATIONS */}
                                <Card className="border-border shadow-sm">
                                  <CardHeader className="bg-slate-50 border-b py-3 px-4">
                                    <CardTitle className="text-sm font-bold flex items-center gap-2">General Stage Recommendation</CardTitle>
                                  </CardHeader>
                                  <CardContent className="p-4">
                                    <Textarea 
                                      placeholder="Type overall recommendations for this stage here..." 
                                      value={recommendation}
                                      onChange={(e) => setRecommendation(e.target.value)}
                                      className="min-h-[150px] bg-white text-sm"
                                    />
                                  </CardContent>
                                </Card>

                                {/* PART C: FIELD PARAMETERS */}
                                <Card className="border-border shadow-sm">
                                  <CardHeader className="bg-slate-50 border-b py-3 px-4 flex flex-row items-center justify-between">
                                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                                      <Ruler className="h-4 w-4 text-primary" /> Parameters to Measure
                                    </CardTitle>
                                    <Button size="sm" onClick={addParamRow} className="h-7 text-xs gap-1" variant="outline"><Plus className="h-3 w-3"/> Add Parameter</Button>
                                  </CardHeader>
                                  <CardContent className="p-0 overflow-y-auto max-h-[200px]">
                                    <Table>
                                      <TableBody>
                                        {selectedParams.length === 0 ? (
                                          <TableRow><TableCell className="text-center py-6 text-muted-foreground italic text-xs">No parameters linked. App will not ask questions.</TableCell></TableRow>
                                        ) : (
                                          selectedParams.map((p, index) => (
                                            <TableRow key={p.id || p.tempId} className="hover:bg-transparent">
                                              <TableCell className="p-2">
                                                <Select value={p.parameter_id} onValueChange={v => updateParamRow(index, 'parameter_id', v)}>
                                                  <SelectTrigger className="h-8 text-xs bg-white"><SelectValue placeholder="Select Parameter..."/></SelectTrigger>
                                                  <SelectContent>
                                                    {parameters.map(param => <SelectItem key={param.id} value={param.id}>{param.parameter_label} ({param.ui_input_type})</SelectItem>)}
                                                  </SelectContent>
                                                </Select>
                                              </TableCell>
                                              <TableCell className="p-2 w-[100px]">
                                                <div className="flex items-center gap-2 border rounded px-2 h-8 bg-white">
                                                  <Checkbox id={`mand-${index}`} checked={p.is_mandatory} onCheckedChange={c => updateParamRow(index, 'is_mandatory', !!c)} />
                                                  <Label htmlFor={`mand-${index}`} className="text-[10px] uppercase font-bold cursor-pointer">Req</Label>
                                                </div>
                                              </TableCell>
                                              <TableCell className="p-2 w-[40px] text-right">
                                                <Button variant="ghost" size="icon" onClick={() => removeParamRow(index)} className="h-7 w-7 text-red-500 hover:bg-red-50"><Trash2 className="h-3 w-3" /></Button>
                                              </TableCell>
                                            </TableRow>
                                          ))
                                        )}
                                      </TableBody>
                                    </Table>
                                  </CardContent>
                                </Card>
                              </div>

                              <div className="flex justify-end pt-4 border-t">
                                <Button onClick={saveActiveStageSop} disabled={savingSop} className="px-8 shadow-md text-sm gap-2 h-10">
                                  {savingSop ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                  Save {stage?.stage_name} Data For {layoutCrops.length} Crop(s)
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        </TabsContent>
                      );
                    })}
                  </Tabs>
                </div>
              )}
            </div>
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
      
      {/* 🚀 NEW: FULL EXCEL-STYLE CROP SOP VIEWER DIALOG */}
      <Dialog open={isSopViewOpen} onOpenChange={setIsSopViewOpen}>
        <DialogContent className="max-w-[95vw] w-full max-h-[90vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="px-6 py-4 border-b bg-muted/10 shrink-0">
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Table2 className="h-5 w-5 text-primary" /> SOP Format View: <span className="text-primary font-bold">{viewCrop?.crop_name}</span>
            </DialogTitle>
            <DialogDescription>Read-only view of the chronologically mapped stages, applications, and parameters.</DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-auto p-6 bg-slate-50">
            {loadingViewSop ? (
               <div className="flex flex-col items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" /><p className="text-sm text-muted-foreground">Generating Table...</p></div>
            ) : viewSopData.length === 0 ? (
               <div className="flex flex-col items-center justify-center py-20 bg-white border border-dashed rounded-lg"><AlertCircle className="h-10 w-10 text-muted-foreground mb-4 opacity-30" /><p className="text-sm font-semibold text-muted-foreground">No SOP Data Found</p><p className="text-xs text-muted-foreground mt-1">Configure this crop in the SOP Builder tab first.</p></div>
            ) : (
              <div className="bg-white border shadow-sm rounded-lg overflow-x-auto">
                <Table className="min-w-[1500px]">
                  <TableHeader className="bg-slate-100/80">
                    <TableRow>
                      <TableHead className="border border-slate-200 font-bold text-slate-800 w-[180px]">Crop Stage</TableHead>
                      <TableHead className="border border-slate-200 font-bold text-slate-800">Application</TableHead>
                      <TableHead className="border border-slate-200 font-bold text-slate-800">DAS</TableHead>
                      <TableHead className="border border-slate-200 font-bold text-slate-800">Application Method</TableHead>
                      <TableHead className="border border-slate-200 font-bold text-slate-800 text-primary">Product</TableHead>
                      <TableHead className="border border-slate-200 font-bold text-slate-800">Dosage / Acre</TableHead>
                      <TableHead className="border border-slate-200 font-bold text-slate-800">Benefit</TableHead>
                      <TableHead className="border border-slate-200 font-bold text-slate-800">Impact</TableHead>
                      <TableHead className="border border-slate-200 font-bold text-slate-800">Recommendation</TableHead>
                      <TableHead className="border border-slate-200 font-bold text-slate-800">Chemicals</TableHead>
                      <TableHead className="border border-slate-200 font-bold text-slate-800">Dosage / Acre</TableHead>
                      <TableHead className="border border-slate-200 font-bold text-slate-800">Parameters To measure</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {viewSopData.map((stage) => {
                      // 🚀 MAGIC: If there are no applications, we render a dummy row so the stage and parameters still show!
                      const apps = stage.sop_applications.length > 0 ? stage.sop_applications : [{}]; 
                      const rowSpan = apps.length;
                      const paramText = stage.sop_parameters.length > 0 
                        ? stage.sop_parameters.map((p: any, i: number) => `${i + 1}. ${p.master_parameters.parameter_label} ${p.is_mandatory ? '(Req)' : ''}`).join('\n')
                        : '--';

                      return apps.map((app: any, idx: number) => (
                        <TableRow key={`${stage.id}-${idx}`} className="hover:bg-transparent">
                          {/* STAGE SPANS ALL ROWS */}
                          {idx === 0 && <TableCell rowSpan={rowSpan} className="border border-slate-200 bg-slate-50 font-bold align-top whitespace-pre-wrap">{stage.master_crop_stages?.stage_name}</TableCell>}
                          
                          {/* APP SPECIFIC COLUMNS */}
                          <TableCell className="border border-slate-200 align-top">{app.application_type || '--'}</TableCell>
                          <TableCell className="border border-slate-200 align-top">{app.das ?? '--'}</TableCell>
                          <TableCell className="border border-slate-200 align-top whitespace-pre-wrap">{app.application_method || '--'}</TableCell>
                          <TableCell className="border border-slate-200 align-top font-bold text-primary">{app.master_gls_products?.product_name || '--'}</TableCell>
                          <TableCell className="border border-slate-200 align-top">{app.dosage_value || '--'}</TableCell>
                          <TableCell className="border border-slate-200 align-top whitespace-pre-wrap">{app.benefit || '--'}</TableCell>
                          <TableCell className="border border-slate-200 align-top whitespace-pre-wrap">{app.impact || '--'}</TableCell>
                          
                          {/* RECOMMENDATION SPANS ALL ROWS */}
                          {idx === 0 && <TableCell rowSpan={rowSpan} className="border border-slate-200 bg-slate-50 align-top whitespace-pre-wrap">{stage.chemical_recommendation_and_dosage || '--'}</TableCell>}
                          
                          {/* CHEMICALS */}
                          <TableCell className="border border-slate-200 align-top whitespace-pre-wrap">{app.chemical_name || '--'}</TableCell>
                          <TableCell className="border border-slate-200 align-top">{app.chemical_dosage || '--'}</TableCell>
                          
                          {/* PARAMS SPAN ALL ROWS */}
                          {idx === 0 && <TableCell rowSpan={rowSpan} className="border border-slate-200 bg-red-50/30 align-top font-medium whitespace-pre-wrap leading-relaxed">{paramText}</TableCell>}
                        </TableRow>
                      ));
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
 
    </AppLayout>
  );
}