import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import AppLayout from '@/components/AppLayout';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { Shield, Loader2, Plus, Settings, Ruler, Leaf, ListTree, AlertCircle, Trash2, Map, FlaskConical, Save, CheckSquare, ChevronUp, ChevronDown, Eye, Layers, Edit2, Image as ImageIcon } from 'lucide-react';

const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || '';
const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || '';

export default function FarmDiaryMasters({ onLogout }: { onLogout: () => void }) {
  const { toast } = useToast();

  const { session, loading: authLoading } = useAuth();
  const { getModulePerm, loading: permLoading } = usePermissions(session?.user?.id);
  const access = getModulePerm('farm_diary_masters');
  const [activeTab, setActiveTab] = useState('crops'); 
  const [loading, setLoading] = useState(false);
  
  const [crops, setCrops] = useState<any[]>([]);
  const [stages, setStages] = useState<any[]>([]);
  const [uoms, setUoms] = useState<any[]>([]);
  const [parameters, setParameters] = useState<any[]>([]);
  const [glsProducts, setGlsProducts] = useState<any[]>([]); 
  const [appTypes, setAppTypes] = useState<string[]>(['Spray', 'Drench', 'Broadcasting', 'Basal Dose', 'Seed Treatment', 'Foliar']);
  
  const [sopGroups, setSopGroups] = useState<any[]>([]);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<any>(null);
  const [groupForm, setGroupForm] = useState({ crops: [] as string[] });

  const [layoutCategory, setLayoutCategory] = useState<string>('');
  const [layoutCrops, setLayoutCrops] = useState<string[]>([]);
  const [layoutStages, setLayoutStages] = useState<string[]>([]); 
  const [activeSopStage, setActiveSopStage] = useState<string>('');
  
  const [applications, setApplications] = useState<any[]>([]);
  const [recommendation, setRecommendation] = useState('');
  const [selectedParams, setSelectedParams] = useState<any[]>([]);
  const [savingSop, setSavingSop] = useState(false);

  const [isCropOpen, setIsCropOpen] = useState(false);
  const [isStageOpen, setIsStageOpen] = useState(false);
  const [isUomOpen, setIsUomOpen] = useState(false);
  const [isParamOpen, setIsParamOpen] = useState(false);
  const [isGlsOpen, setIsGlsOpen] = useState(false);
  const [isMapUomOpen, setIsMapUomOpen] = useState(false);

  const [isSopViewOpen, setIsSopViewOpen] = useState(false);
  const [viewCrop, setViewCrop] = useState<any>(null);
  const [viewSopData, setViewSopData] = useState<any[]>([]);
  const [loadingViewSop, setLoadingViewSop] = useState(false);

  const [activeParam, setActiveParam] = useState<any>(null);
  const [selectedUoms, setSelectedUoms] = useState<string[]>([]);
  const [defaultUom, setDefaultUom] = useState<string>('');

  const [newCrop, setNewCrop] = useState({ id: '', name: '', category: '' });
  const [isAddingNewCategory, setIsAddingNewCategory] = useState(false);
  const [newStage, setNewStage] = useState({ id: '', name: '' });
  const [newUom, setNewUom] = useState({ id: '', name: '', symbol: '' });
  
  const [newParam, setNewParam] = useState({ 
    id: '', label: '', type: 'Numeric', options: [] as string[], uoms: [] as string[], defaultUom: '' 
  });
  const [optionInput, setOptionInput] = useState(''); 
  
  const [newGls, setNewGls] = useState({
    id: '', name: '', ingredients: '', description: '', benefits: '', impact: '', image_url: ''
  });
  const [uploadingImage, setUploadingImage] = useState(false);

  const db = supabase as any;

  useEffect(() => { fetchMasters(); }, []);

  useEffect(() => {
    if (layoutStages.length > 0 && (!activeSopStage || !layoutStages.includes(activeSopStage))) {
      setActiveSopStage(layoutStages[0]);
    }
  }, [layoutStages]);

  useEffect(() => {
    if (layoutCrops.length > 0 && activeSopStage) {
      loadExistingSOP(layoutCrops[0], activeSopStage);
    } else {
      setApplications([]);
      setRecommendation('');
      setSelectedParams([]);
    }
  }, [layoutCrops, activeSopStage]);

  const fetchMasters = async () => {
    setLoading(true);
    const [cropsRes, stagesRes, uomRes, paramsRes, glsRes, groupsRes] = await Promise.all([
      db.from('master_crops').select('*').order('crop_name'),
      db.from('master_crop_stages').select('*').order('stage_name'),
      db.from('master_uom').select('*').order('uom_name'),
      db.from('master_parameters').select('*').order('parameter_label'),
      db.from('master_gls_products').select('*').order('product_name'),
      db.from('sop_groups').select('*').order('created_at', { ascending: false })
    ]);

    if (cropsRes.data) setCrops(cropsRes.data);
    if (stagesRes.data) setStages(stagesRes.data);
    if (uomRes.data) setUoms(uomRes.data);
    if (paramsRes.data) setParameters(paramsRes.data);
    if (glsRes.data) setGlsProducts(glsRes.data);
    if (groupsRes.data) setSopGroups(groupsRes.data);
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

  const handleViewCropSop = async (crop: any) => {
    setViewCrop(crop);
    setIsSopViewOpen(true);
    setLoadingViewSop(true);

    const { data, error } = await db.from('sop_crop_stages')
      .select(`
        id, stage_sequence, chemical_recommendation_and_dosage,
        master_crop_stages ( stage_name ),
        sop_applications ( id, application_type, das, application_method, dosage_value, benefit, impact, recommendation, chemical_name, chemical_dosage, master_gls_products ( product_name ) ),
        sop_parameters ( is_mandatory, master_parameters ( parameter_label ) )
      `)
      .eq('crop_id', crop.id)
      .order('stage_sequence', { ascending: true });

    if (error) {
      toast({ title: 'Error fetching SOP', description: error.message, variant: 'destructive' });
    } else if (data) {
      const formattedData = data.map((stage: any) => {
        stage.sop_applications.sort((a: any, b: any) => Number(a.das) - Number(b.das));
        return stage;
      });
      setViewSopData(formattedData);
    }
    setLoadingViewSop(false);
  };

  const cloneSopToNewCrops = async (sourceCropId: string, targetCropIds: string[]) => {
    const { data: sourceStages } = await db.from('sop_crop_stages').select('*').eq('crop_id', sourceCropId);
    if (!sourceStages || sourceStages.length === 0) return;

    for (const targetCropId of targetCropIds) {
      await db.from('sop_crop_stages').delete().eq('crop_id', targetCropId);

      for (const stage of sourceStages) {
        const { data: newStage } = await db.from('sop_crop_stages').insert([{
          crop_id: targetCropId, stage_id: stage.stage_id, stage_sequence: stage.stage_sequence, chemical_recommendation_and_dosage: stage.chemical_recommendation_and_dosage
        }]).select('id').single();

        if (newStage) {
          const { data: sourceApps } = await db.from('sop_applications').select('*').eq('sop_crop_stage_id', stage.id);
          if (sourceApps && sourceApps.length > 0) {
            const newApps = sourceApps.map((app: any) => { const { id, ...rest } = app; return { ...rest, sop_crop_stage_id: newStage.id }; });
            await db.from('sop_applications').insert(newApps);
          }

          const { data: sourceParams } = await db.from('sop_parameters').select('*').eq('sop_crop_stage_id', stage.id);
          if (sourceParams && sourceParams.length > 0) {
            const newParams = sourceParams.map((p: any) => { const { id, ...rest } = p; return { ...rest, sop_crop_stage_id: newStage.id }; });
            await db.from('sop_parameters').insert(newParams);
          }
        }
      }
    }
  };

  const openEditGroup = (group: any) => {
    setEditingGroup(group);
    setGroupForm({ crops: group.crop_ids || [] });
    setIsGroupModalOpen(true);
  };

  const saveGroup = async () => {
    if (!editingGroup) return;
    setLoading(true);

    const oldCrops = editingGroup.crop_ids || [];
    const newlyAddedCrops = groupForm.crops.filter(id => !oldCrops.includes(id));
    const removedCrops = oldCrops.filter((id: string) => !groupForm.crops.includes(id));
    const sourceCropId = oldCrops.length > 0 ? oldCrops[0] : groupForm.crops[0];

    if (removedCrops.length > 0) {
      toast({ title: "Cleaning Up", description: "Wiping previous SOP schedules for removed crops..." });
      for (const cropId of removedCrops) {
        const { data: stagesToDel } = await db.from('sop_crop_stages').select('id').eq('crop_id', cropId);
        if (stagesToDel && stagesToDel.length > 0) {
          const stageIds = stagesToDel.map((s: any) => s.id);
          await db.from('sop_applications').delete().in('sop_crop_stage_id', stageIds);
          await db.from('sop_parameters').delete().in('sop_crop_stage_id', stageIds);
          await db.from('sop_crop_stages').delete().in('id', stageIds);
        }
      }
    }

    if (sourceCropId && newlyAddedCrops.length > 0) {
      toast({ title: "Cloning SOP", description: "Applying group SOP to the newly added crops..." });
      await cloneSopToNewCrops(sourceCropId, newlyAddedCrops);
    }

    const { error } = await db.from('sop_groups').update({ crop_ids: groupForm.crops }).eq('id', editingGroup.id);

    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else toast({ title: "Success", description: "Group updated & SOP applied successfully." });
      
    setIsGroupModalOpen(false);
    fetchMasters();
  };

  const deleteGroup = async (id: string) => {
    if (!confirm("Are you sure you want to delete this group? The crops will keep their SOPs, but the grouping link will be removed.")) return;
    const { error } = await db.from('sop_groups').delete().eq('id', id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else fetchMasters();
  };

  const handleEditGroupSop = async (group: any) => {
    setLoading(true);
    setLayoutCategory(group.category);
    
    const validCropIds = (group.crop_ids || []).filter((id: string) => crops.some(c => c.id === id));
    setLayoutCrops(validCropIds);

    const { data: stagesData } = await db.from('sop_crop_stages').select('stage_id').in('crop_id', validCropIds).order('stage_sequence', { ascending: true });

    if (stagesData) {
      const uniqueStageIds: string[] = Array.from(new Set(stagesData.map((s: any) => String(s.stage_id))));
      setLayoutStages(uniqueStageIds);
      if (uniqueStageIds.length > 0 && validCropIds.length > 0) {
        setActiveSopStage(uniqueStageIds[0]);
        await loadExistingSOP(validCropIds[0], uniqueStageIds[0]);
      }
    }

    setActiveTab('layout'); 
    setLoading(false);
    toast({ title: "Loaded Group", description: "Crops and stages populated in SOP Builder." });
  };

  const handleViewGroupSop = (group: any) => {
    if (!group.crop_ids || group.crop_ids.length === 0) return toast({ title: "Empty Group", description: "No crops in this group to preview.", variant: "destructive" });
    const representativeCrop = crops.find(c => c.id === group.crop_ids[0]);
    if (representativeCrop) handleViewCropSop({ ...representativeCrop, crop_name: `${group.group_name} (Preview)` });
  };

  const allAssignedCropIds = Array.from(new Set(sopGroups.flatMap(g => g.crop_ids || [])));
  const uniqueCategories = Array.from(new Set(crops.map(c => c.crop_category).filter(Boolean)));
  
  const toggleLayoutCrop = (cropId: string) => { setLayoutCrops(prev => prev.includes(cropId) ? prev.filter(id => id !== cropId) : [...prev, cropId]); };
  const toggleLayoutStage = (stageId: string) => { setLayoutStages(prev => prev.includes(stageId) ? prev.filter(id => id !== stageId) : [...prev, stageId]); };
  
  // 🚀 FIXED: Only auto-selects valid, unassigned crops from the currently chosen category
  const selectAllFilteredCrops = () => {
    const availableIds = crops
      .filter(c => layoutCategory === '' || layoutCategory === 'ALL' || c.crop_category === layoutCategory)
      .filter(c => !allAssignedCropIds.includes(c.id) || layoutCrops.includes(c.id))
      .map(c => c.id);
    setLayoutCrops(availableIds);
  };
  
  const toggleGroupCrop = (cropId: string) => { setGroupForm(prev => ({ crops: prev.crops.includes(cropId) ? prev.crops.filter(id => id !== cropId) : [...prev.crops, cropId] })); };

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
    const activeValidCrops = layoutCrops.filter(id => crops.some(c => c.id === id));
    
    if (activeValidCrops.length === 0 || layoutStages.length === 0) {
      if (layoutCrops.length > 0) setLayoutCrops([]); 
      return toast({ title: "Error", description: "No valid crops selected. They may have been deleted.", variant: "destructive" });
    }

    setLoading(true);
    try {
      for (const cropId of activeValidCrops) {
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

      if (activeValidCrops.length > 0) {
        const derivedCategory = layoutCategory || crops.find(c => c.id === activeValidCrops[0])?.crop_category || 'Mixed';
        const cropNames = activeValidCrops.map(id => crops.find(c => c.id === id)?.crop_name).filter(Boolean);
        const namePreview = cropNames.slice(0, 2).join(', ') + (cropNames.length > 2 ? ` +${cropNames.length - 2}` : '');
        const groupName = `${derivedCategory}: ${namePreview}`;

        // 🚀 FIXED: Finds existing groups safely and merges them to prevent duplicates
        const intersectingGroups = sopGroups.filter(g => g.crop_ids?.some((id: string) => activeValidCrops.includes(id)));

        if (intersectingGroups.length > 0) {
          const primaryGroup = intersectingGroups[0];
          await db.from('sop_groups').update({ group_name: groupName, category: derivedCategory, crop_ids: activeValidCrops }).eq('id', primaryGroup.id);
          
          for (let i = 1; i < intersectingGroups.length; i++) {
            await db.from('sop_groups').delete().eq('id', intersectingGroups[i].id);
          }
        } else {
          await db.from('sop_groups').insert([{ group_name: groupName, category: derivedCategory, crop_ids: activeValidCrops }]);
        }
      }
      
      if (activeValidCrops.length !== layoutCrops.length) setLayoutCrops(activeValidCrops);
      
      toast({ title: "Order Saved", description: "Global stage sequence locked in." });
      fetchMasters();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
    setLoading(false);
  };

  const deleteMaster = async (table: string, id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"?\nWARNING: This action is permanent and may affect related data.`)) return;
    
    setLoading(true);
    try {
      if (table === 'master_crops') {
        setLayoutCrops(prev => prev.filter(cid => cid !== id)); 
        
        const affectedGroups = sopGroups.filter(g => g.crop_ids?.includes(id));
        for (const group of affectedGroups) {
          const newCropIds = group.crop_ids.filter((cid: string) => cid !== id);
          if (newCropIds.length === 0) {
            await db.from('sop_groups').delete().eq('id', group.id);
          } else {
            const remainingCrops = crops.filter(c => newCropIds.includes(c.id));
            const cropNames = remainingCrops.map(c => c.crop_name).filter(Boolean);
            const namePreview = cropNames.slice(0, 2).join(', ') + (cropNames.length > 2 ? ` +${cropNames.length - 2}` : '');
            const newGroupName = `${group.category}: ${namePreview}`;
            await db.from('sop_groups').update({ crop_ids: newCropIds, group_name: newGroupName }).eq('id', group.id);
          }
        }
      }

      if (table === 'master_crop_stages') {
        setLayoutStages(prev => prev.filter(sid => sid !== id));
        if (activeSopStage === id) setActiveSopStage('');
      }

      const { error } = await db.from(table).delete().eq('id', id);
      if (error) throw error;
      
      toast({ title: "Deleted", description: `"${name}" removed successfully.` });
      fetchMasters();
      
    } catch (err: any) {
      if (err.message?.includes('foreign key constraint')) {
        toast({ title: "Delete Blocked by Database", description: `Cannot delete "${name}" because it is actively linked to other records.`, variant: "destructive" });
      } else {
        toast({ title: "Delete Failed", description: err.message, variant: "destructive" });
      }
    } finally {
      setLoading(false);
    }
  };

  const openEditCrop = (c: any) => { setNewCrop({ id: c.id, name: c.crop_name, category: c.crop_category }); setIsAddingNewCategory(false); setIsCropOpen(true); };
  const openEditStage = (s: any) => { setNewStage({ id: s.id, name: s.stage_name }); setIsStageOpen(true); };
  const openEditUom = (u: any) => { setNewUom({ id: u.id, name: u.uom_name, symbol: u.uom_symbol }); setIsUomOpen(true); };
  const openEditGls = (g: any) => { setNewGls({ id: g.id, name: g.product_name, ingredients: g.active_ingredients || '', description: g.description || '', benefits: g.benefits || '', impact: g.impact || '', image_url: g.image_url || '' }); setIsGlsOpen(true); };
  
  const openEditParam = async (p: any) => { 
    const { data } = await db.from('parameter_uom_mapping').select('*').eq('parameter_id', p.id);
    const mappedUoms = data ? data.map((d: any) => d.uom_id) : [];
    const defUom = data?.find((d: any) => d.is_default_uom)?.uom_id || '';
    setNewParam({ id: p.id, label: p.parameter_label, type: p.ui_input_type, options: p.options_data || [], uoms: mappedUoms, defaultUom: defUom });
    setOptionInput('');
    setIsParamOpen(true); 
  };

  const handleAddOption = () => {
    if (!optionInput.trim()) return;
    if (newParam.options.includes(optionInput.trim())) return toast({ title: "Duplicate", description: "This option already exists.", variant: "destructive" });
    setNewParam(prev => ({ ...prev, options: [...prev.options, optionInput.trim()] }));
    setOptionInput('');
  };

  const handleRemoveOption = (index: number) => {
    setNewParam(prev => ({ ...prev, options: prev.options.filter((_, i) => i !== index) }));
  };

  const handleAddCrop = async () => {
    if (!newCrop.name.trim() || !newCrop.category.trim()) return toast({ title: "Error", description: "Required", variant: "destructive" });
    if (newCrop.id) await db.from('master_crops').update({ crop_name: newCrop.name.trim(), crop_category: newCrop.category.trim() }).eq('id', newCrop.id);
    else await db.from('master_crops').insert([{ crop_name: newCrop.name.trim(), crop_category: newCrop.category.trim(), status: 'Active' }]);
    setIsCropOpen(false); setNewCrop({ id: '', name: '', category: '' }); fetchMasters();
  };

  const handleAddStage = async () => {
    if (!newStage.name.trim()) return toast({ title: "Error", description: "Required", variant: "destructive" });
    if (newStage.id) await db.from('master_crop_stages').update({ stage_name: newStage.name.trim() }).eq('id', newStage.id);
    else await db.from('master_crop_stages').insert([{ stage_name: newStage.name.trim(), stage_code: newStage.name.substring(0,3).toUpperCase() }]);
    setIsStageOpen(false); setNewStage({ id: '', name: '' }); fetchMasters();
  };

  const handleAddUom = async () => {
    if (!newUom.name.trim() || !newUom.symbol.trim()) return toast({ title: "Error", description: "Required", variant: "destructive" });
    if (newUom.id) await db.from('master_uom').update({ uom_name: newUom.name.trim(), uom_symbol: newUom.symbol.trim() }).eq('id', newUom.id);
    else await db.from('master_uom').insert([{ uom_name: newUom.name.trim(), uom_symbol: newUom.symbol.trim() }]);
    setIsUomOpen(false); setNewUom({ id: '', name: '', symbol: '' }); fetchMasters();
  };

  const handleAddParameter = async () => {
    if (!newParam.label.trim()) return toast({ title: "Error", description: "Label required", variant: "destructive" });
    if (newParam.type === 'Numeric' && newParam.uoms.length > 0 && !newParam.defaultUom) return toast({ title: "Error", description: "Please select a default UOM", variant: "destructive" });

    let options = newParam.type === 'Dropdown Choice' ? newParam.options : [];
    let paramId = newParam.id;

    if (newParam.id) {
      await db.from('master_parameters').update({ parameter_label: newParam.label.trim(), ui_input_type: newParam.type, options_data: options }).eq('id', newParam.id);
      await db.from('parameter_uom_mapping').delete().eq('parameter_id', newParam.id); 
    } else {
      const { data: pData, error } = await db.from('master_parameters').insert([{ parameter_label: newParam.label.trim(), ui_input_type: newParam.type, options_data: options }]).select('id').single();
      if (error) return toast({ title: "Error", description: error.message, variant: "destructive" });
      paramId = pData.id;
    }

    if (newParam.type === 'Numeric' && newParam.uoms.length > 0 && paramId) {
      const inserts = newParam.uoms.map((uomId: string) => ({ parameter_id: paramId, uom_id: uomId, is_default_uom: uomId === newParam.defaultUom }));
      await db.from('parameter_uom_mapping').insert(inserts);
    }
    setIsParamOpen(false); 
    setNewParam({ id: '', label: '', type: 'Numeric', options: [], uoms: [], defaultUom: '' }); 
    setOptionInput('');
    fetchMasters();
    toast({ title: "Success", description: "Parameter mapped and saved!" });
  };

  const handleProductImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const file = e.target.files?.[0];
      if (!file) return;
      
      setUploadingImage(true);
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET); 

      const endpoint = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;
      const response = await fetch(endpoint, { method: 'POST', body: formData });
      const data = await response.json();

      if (!response.ok) throw new Error(data.error?.message || 'Cloudinary upload failed');
      
      setNewGls(prev => ({ ...prev, image_url: data.secure_url }));
      toast({ title: "Upload Success", description: "Image attached." });
    } catch (err: any) {
      toast({ title: "Upload Failed", description: err.message, variant: "destructive" });
    } finally {
      setUploadingImage(false);
    }
  };

  const handleAddGls = async () => {
    if (!newGls.name.trim()) return toast({ title: "Error", description: "Product name is required.", variant: "destructive" });
    const payload = { product_name: newGls.name, active_ingredients: newGls.ingredients, description: newGls.description, benefits: newGls.benefits, impact: newGls.impact, image_url: newGls.image_url };
    
    if (newGls.id) await db.from('master_gls_products').update(payload).eq('id', newGls.id);
    else await db.from('master_gls_products').insert([payload]);
    
    setIsGlsOpen(false); setNewGls({ id: '', name: '', ingredients: '', description: '', benefits: '', impact: '', image_url: '' }); fetchMasters();
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
    const activeValidCrops = layoutCrops.filter(id => crops.some(c => c.id === id));
    
    if (activeValidCrops.length === 0 || !activeSopStage) {
      if (layoutCrops.length > 0) setLayoutCrops([]); 
      return toast({ title: "Error", description: "Select valid crop and stage.", variant: "destructive" });
    }
    
    const hasEmptyDas = applications.some(a => a.das === '' || a.das === null);
    if (hasEmptyDas) return toast({ title: "Error", description: "DAS is required for all applications.", variant: "destructive" });

    setSavingSop(true);

    try {
      const stageSeq = layoutStages.indexOf(activeSopStage) + 1;

      for (const cropId of activeValidCrops) {
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

      if (activeValidCrops.length > 0) {
        const derivedCategory = layoutCategory || crops.find(c => c.id === activeValidCrops[0])?.crop_category || 'Mixed';
        const cropNames = activeValidCrops.map(id => crops.find(c => c.id === id)?.crop_name).filter(Boolean);
        const namePreview = cropNames.slice(0, 2).join(', ') + (cropNames.length > 2 ? ` +${cropNames.length - 2}` : '');
        const groupName = `${derivedCategory}: ${namePreview}`;

        // 🚀 FIXED: Safely merge intersecting groups
        const intersectingGroups = sopGroups.filter(g => g.crop_ids?.some((id: string) => activeValidCrops.includes(id)));

        if (intersectingGroups.length > 0) {
          const primaryGroup = intersectingGroups[0];
          await db.from('sop_groups').update({ group_name: groupName, category: derivedCategory, crop_ids: activeValidCrops }).eq('id', primaryGroup.id);
          for (let i = 1; i < intersectingGroups.length; i++) {
            await db.from('sop_groups').delete().eq('id', intersectingGroups[i].id);
          }
        } else {
          await db.from('sop_groups').insert([{ group_name: groupName, category: derivedCategory, crop_ids: activeValidCrops }]);
        }
      }

      if (activeValidCrops.length !== layoutCrops.length) setLayoutCrops(activeValidCrops);

      toast({ title: "Success!", description: `Stage SOP saved for ${activeValidCrops.length} crop(s).` });
      if (activeValidCrops.length === 1) loadExistingSOP(activeValidCrops[0], activeSopStage);
      
      fetchMasters();

    } catch (err: any) {
      toast({ title: "Save Failed", description: err.message, variant: "destructive" });
    }
    setSavingSop(false);
  };

  if (authLoading || permLoading) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!access.can_view) {
    return (
      <AppLayout onLogout={onLogout}>
        <div className="flex flex-col items-center justify-center h-[60vh] text-center">
          <Shield className="h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold">Access Denied</h2>
          <p className="text-muted-foreground">You do not have permission to view Farm Diary Masters.</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout onLogout={onLogout}>
      <div className="flex flex-col gap-6 animate-in fade-in duration-300 pb-20">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Farm Diary Configuration</h2>
          <p className="text-muted-foreground">Manage decoupled master repositories and dynamic crop schedules.</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-7 mb-4 h-12">
            <TabsTrigger value="crops" className="gap-2"><Leaf className="h-4 w-4"/> Crops</TabsTrigger>
            <TabsTrigger value="stages" className="gap-2"><ListTree className="h-4 w-4"/> Stages</TabsTrigger>
            <TabsTrigger value="gls" className="gap-2"><FlaskConical className="h-4 w-4"/> Products</TabsTrigger>
            <TabsTrigger value="uom" className="gap-2"><Ruler className="h-4 w-4"/> UOMs</TabsTrigger>
            <TabsTrigger value="parameters" className="gap-2"><Settings className="h-4 w-4"/> Parameters</TabsTrigger>
            <TabsTrigger value="layout" className="gap-2 bg-primary/5 data-[state=active]:bg-primary/10"><Map className="h-4 w-4"/> SOP Builder</TabsTrigger>
            <TabsTrigger value="groups" className="gap-2"><Layers className="h-4 w-4"/> SOP Groups</TabsTrigger>
          </TabsList>

          {/* ==================== 🚀 SOP GROUPS TAB ==================== */}
          <TabsContent value="groups">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between bg-muted/20 border-b pb-4">
                <div>
                  <CardTitle>SOP Crop Groups</CardTitle>
                  <CardDescription>Auto-generated bundles of crops sharing the same SOP layout.</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                {sopGroups.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
                    <Layers className="h-10 w-10 mx-auto mb-3 opacity-20" />
                    <p>No SOP Groups created yet.</p>
                    <p className="text-sm mt-1">Use the <b>SOP Builder</b> to map a schedule to multiple crops to auto-generate a group.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {sopGroups.map(group => (
                      <Card key={group.id} className="flex flex-col shadow-sm hover:shadow-md transition-shadow border-primary/20">
                        <CardHeader className="pb-3 border-b bg-slate-50/50">
                          <div className="flex justify-between items-start">
                            <CardTitle className="text-lg line-clamp-2" title={group.group_name}>{group.group_name}</CardTitle>
                            <Badge variant="outline" className="bg-white shrink-0 ml-2">{group.category}</Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="py-4 flex-1">
                          <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">
                            Included Crops ({ (group.crop_ids || []).filter((id: string) => crops.some(c => c.id === id)).length })
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {(group.crop_ids || []).map((id: string) => {
                              const crop = crops.find(c => c.id === id);
                              return crop ? <Badge key={id} variant="secondary" className="font-normal">{crop.crop_name}</Badge> : null;
                            })}
                          </div>
                        </CardContent>
                        <CardFooter className="pt-3 pb-3 border-t bg-slate-50 flex justify-between gap-2 flex-wrap">
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" className="h-8 text-xs bg-white" onClick={() => handleViewGroupSop(group)}>
                              <Eye className="h-3 w-3 mr-1.5" /> View SOP
                            </Button>
                            {access.can_edit && <Button variant="default" size="sm" className="h-8 text-xs shadow-sm" onClick={() => handleEditGroupSop(group)}>
                              <Map className="h-3 w-3 mr-1.5" /> Edit SOP
                            </Button>}
                          </div>
                          {access.can_edit && (
                            <div className="flex gap-2">
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500" onClick={() => openEditGroup(group)}>
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:bg-red-50" onClick={() => deleteGroup(group.id)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </CardFooter>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
            
            <Dialog open={isGroupModalOpen} onOpenChange={setIsGroupModalOpen}>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Manage Group Crops</DialogTitle>
                  <DialogDescription>Add new crops to this group. They will automatically inherit the group's SOP layout.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="bg-muted/20 p-3 rounded-md border">
                    <p className="text-sm font-semibold">{editingGroup?.group_name}</p>
                    <p className="text-xs text-muted-foreground mt-1">Category: <Badge variant="secondary" className="font-normal">{editingGroup?.category}</Badge></p>
                  </div>
                  
                  {editingGroup?.category && (
                    <div className="space-y-2 animate-in fade-in pt-2">
                      <Label className="flex justify-between items-center">
                        Select Crops to Include
                        <span className="text-xs text-muted-foreground font-normal">{groupForm.crops.length} selected</span>
                      </Label>
                      <div className="bg-slate-50 border rounded-md p-3 max-h-[250px] overflow-y-auto grid grid-cols-2 gap-2 shadow-inner">
                        {crops
                          .filter(c => c.crop_category === editingGroup?.category)
                          .map(c => {
                            const isAssignedElsewhere = allAssignedCropIds.includes(c.id) && !groupForm.crops.includes(c.id);
                            return (
                              <div key={c.id} className={`flex items-center space-x-2 p-1.5 border rounded-sm ${isAssignedElsewhere ? 'bg-slate-50 opacity-60' : 'bg-white'}`}>
                                <Checkbox id={`g-crop-${c.id}`} disabled={isAssignedElsewhere} checked={groupForm.crops.includes(c.id)} onCheckedChange={() => toggleGroupCrop(c.id)} />
                                <Label htmlFor={`g-crop-${c.id}`} className={`text-xs font-medium truncate flex-1 ${isAssignedElsewhere ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                                  {c.crop_name} {isAssignedElsewhere && <span className="text-[9px] text-red-500 font-bold ml-1">(Assigned)</span>}
                                </Label>
                              </div>
                            );
                        })}
                      </div>
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsGroupModalOpen(false)}>Cancel</Button>
                  <Button onClick={saveGroup}>Save Changes</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </TabsContent>

          {/* ==================== CROPS TAB ==================== */}
          <TabsContent value="crops">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between bg-muted/20 border-b pb-4">
                <div><CardTitle>Master of Crops</CardTitle><CardDescription>Global registry of supported crops and their categories.</CardDescription></div>
                <Dialog open={isCropOpen} onOpenChange={(o) => { setIsCropOpen(o); if(!o) setIsAddingNewCategory(false); }}>
                {access.can_edit && <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-2"/> Add Crop</Button></DialogTrigger>}
                  <DialogContent>
                    <DialogHeader><DialogTitle>{newCrop.id ? 'Edit Crop' : 'Add New Crop'}</DialogTitle></DialogHeader>
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
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" size="icon" onClick={() => handleViewCropSop(c)} className="h-8 w-8 text-primary border-primary/20 hover:bg-primary/10" title="View Format"><Eye className="h-4 w-4" /></Button>
                            {access.can_edit && (
                              <>
                                <Button variant="ghost" size="icon" onClick={() => openEditCrop(c)} className="h-8 w-8 text-slate-500 hover:bg-slate-100"><Edit2 className="h-4 w-4" /></Button>
                                <Button variant="ghost" size="icon" onClick={() => deleteMaster('master_crops', c.id, c.crop_name)} className="h-8 w-8 text-red-500 hover:bg-red-50"><Trash2 className="h-4 w-4" /></Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ==================== STAGES TAB ==================== */}
          <TabsContent value="stages">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between bg-muted/20 border-b pb-4">
                <div><CardTitle>Master of Crop Stages</CardTitle><CardDescription>Developmental milestones for crops.</CardDescription></div>
                <Dialog open={isStageOpen} onOpenChange={setIsStageOpen}>
                {access.can_edit && <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-2"/> Add Stage</Button></DialogTrigger>}
                  <DialogContent>
                    <DialogHeader><DialogTitle>{newStage.id ? 'Edit Stage' : 'Add New Stage'}</DialogTitle></DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2"><Label>Stage Name *</Label><Input placeholder="e.g. Flowering" value={newStage.name} onChange={e => setNewStage({...newStage, name: e.target.value})} /></div>
                    </div>
                    <DialogFooter><Button onClick={handleAddStage}>Save Stage</Button></DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-6">Stage Name</TableHead>
                      <TableHead>Auto-Generated Code</TableHead>
                      <TableHead className="text-right pr-6">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stages.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-8">No stages defined yet.</TableCell></TableRow>}
                    {stages.map(s => (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium pl-6">{s.stage_name}</TableCell>
                        <TableCell><Badge variant="secondary" className="font-mono">{s.stage_code}</Badge></TableCell>
                        <TableCell className="text-right pr-6">
                          <div className="flex justify-end gap-2">
                          {access.can_edit && (
                            <>
                              <Button variant="ghost" size="icon" onClick={() => openEditStage(s)} className="h-8 w-8 text-slate-500 hover:bg-slate-100"><Edit2 className="h-4 w-4" /></Button>
                              <Button variant="ghost" size="icon" onClick={() => deleteMaster('master_crop_stages', s.id, s.stage_name)} className="h-8 w-8 text-red-500 hover:bg-red-50"><Trash2 className="h-4 w-4" /></Button>
                            </>
                          )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ==================== GLS PRODUCTS TAB ==================== */}
          <TabsContent value="gls">
            <Card className="border-border shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between bg-muted/30 border-b pb-4 pt-5 px-6">
                <div className="space-y-1">
                  <CardTitle className="text-lg flex items-center gap-2">Master of Products</CardTitle>
                  <CardDescription>Registry of products used in applications with rich descriptive parameters.</CardDescription>
                </div>
                <Dialog open={isGlsOpen} onOpenChange={(open) => {
                  if (!open) setNewGls({ id: '', name: '', ingredients: '', description: '', benefits: '', impact: '', image_url: '' });
                  setIsGlsOpen(open);
                }}>
                  {access.can_edit && <DialogTrigger asChild><Button size="sm" className="gap-1.5 shadow-sm"><Plus className="h-4 w-4" /> Add Product</Button></DialogTrigger>}
                  <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden">
                    <DialogHeader className="px-6 py-4 border-b bg-muted/30"><DialogTitle>{newGls.id ? 'Edit Product Profile' : 'Add New Product Profile'}</DialogTitle></DialogHeader>
                    <div className="px-6 py-4 max-h-[65vh] overflow-y-auto space-y-5 custom-scrollbar">
                      
                      <div className="space-y-2">
                        <Label className="text-sm font-semibold text-foreground">Product Image</Label>
                        <div className="flex items-center gap-4 bg-slate-50 p-3 rounded-lg border border-dashed">
                          {newGls.image_url ? (
                            <img src={newGls.image_url} alt="Preview" className="h-16 w-16 object-cover rounded-md border shadow-sm shrink-0" />
                          ) : (
                            <div className="h-16 w-16 bg-slate-200 rounded-md flex items-center justify-center border text-slate-400 shrink-0">
                              <ImageIcon className="h-6 w-6" />
                            </div>
                          )}
                          <div className="flex-1">
                            <Input type="file" accept="image/*" onChange={handleProductImageUpload} disabled={uploadingImage} className="bg-white" />
                            {uploadingImage && <p className="text-xs text-indigo-600 mt-1 flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Uploading to Cloudinary...</p>}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-sm font-semibold text-foreground">Product Name *</Label>
                          <Input value={newGls.name} onChange={e => setNewGls({...newGls, name: e.target.value})} placeholder="e.g., Earthflow Bio-Boost" className="bg-white" />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-sm font-semibold text-foreground">Active Ingredients</Label>
                          <Input placeholder="e.g., Azotobacter 20%" value={newGls.ingredients} onChange={e => setNewGls({...newGls, ingredients: e.target.value})} className="bg-white" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-semibold text-foreground">Product Description</Label>
                        <textarea className="flex min-h-[80px] w-full rounded-md border border-input bg-white px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 custom-scrollbar"
                          placeholder="Provide a comprehensive summary of the product composition and intended usage..."
                          value={newGls.description} onChange={e => setNewGls({...newGls, description: e.target.value})} />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-sm font-semibold text-foreground">Benefits & Advantages</Label>
                          <textarea className="flex min-h-[80px] w-full rounded-md border border-input bg-white px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 custom-scrollbar"
                            placeholder="e.g., Increases crop yield by 15%..." value={newGls.benefits} onChange={e => setNewGls({...newGls, benefits: e.target.value})} />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-sm font-semibold text-foreground">Impact on Soil/Crop</Label>
                          <textarea className="flex min-h-[80px] w-full rounded-md border border-input bg-white px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 custom-scrollbar"
                            placeholder="e.g., Restores microbiome balance..." value={newGls.impact} onChange={e => setNewGls({...newGls, impact: e.target.value})} />
                        </div>
                      </div>
                    </div>
                    <DialogFooter className="px-6 py-4 border-t bg-muted/20">
                      <Button variant="outline" onClick={() => setIsGlsOpen(false)}>Cancel</Button>
                      <Button onClick={handleAddGls} disabled={uploadingImage}>Save Product Profile</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead className="pl-6 font-semibold w-[25%]">Product</TableHead>
                        <TableHead className="font-semibold w-[15%]">Active Ingredients</TableHead>
                        <TableHead className="font-semibold w-[20%]">Description</TableHead>
                        <TableHead className="font-semibold w-[20%]">Benefits</TableHead>
                        <TableHead className="font-semibold w-[15%]">Impact</TableHead>
                        <TableHead className="font-semibold w-[5%] text-right pr-6">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {glsProducts.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                            <div className="flex flex-col items-center justify-center gap-1">
                              <span className="font-medium text-slate-500">No products cataloged yet.</span>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                      {glsProducts.map(g => (
                        <TableRow key={g.id} className="hover:bg-muted/30 transition-colors">
                          <TableCell className="pl-6 align-top pt-4">
                            <div className="flex items-center gap-3">
                              {g.image_url ? (
                                <img src={g.image_url} alt="Product" className="h-10 w-10 object-cover rounded-md border shadow-sm shrink-0" />
                              ) : (
                                <div className="h-10 w-10 bg-slate-100 rounded-md border flex items-center justify-center shrink-0">
                                  <ImageIcon className="h-4 w-4 text-slate-300" />
                                </div>
                              )}
                              <span className="font-semibold text-foreground">{g.product_name}</span>
                            </div>
                          </TableCell>
                          <TableCell className="align-top pt-4"><Badge variant="secondary" className="font-normal bg-slate-100 text-slate-700 border-slate-200">{g.active_ingredients || 'N/A'}</Badge></TableCell>
                          <TableCell className="align-top pt-4"><div className="line-clamp-2 text-xs text-muted-foreground" title={g.description || ''}>{g.description || '—'}</div></TableCell>
                          <TableCell className="align-top pt-4"><div className="line-clamp-2 text-xs text-slate-600" title={g.benefits || ''}>{g.benefits || '—'}</div></TableCell>
                          <TableCell className="align-top pt-4"><div className="line-clamp-2 text-xs text-slate-600" title={g.impact || ''}>{g.impact || '—'}</div></TableCell>
                          <TableCell className="align-top pt-4 text-right pr-6">
                            <div className="flex justify-end gap-1">
                            {access.can_edit && (
                              <>
                                <Button variant="ghost" size="icon" onClick={() => openEditGls(g)} className="h-8 w-8 text-slate-500 hover:bg-slate-100"><Edit2 className="h-4 w-4" /></Button>
                                <Button variant="ghost" size="icon" onClick={() => deleteMaster('master_gls_products', g.id, g.product_name)} className="h-8 w-8 text-red-500 hover:bg-red-50"><Trash2 className="h-4 w-4" /></Button>
                              </>
                            )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ==================== PARAMETERS TAB ==================== */}
          <TabsContent value="parameters">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between bg-muted/20 border-b pb-4">
                <div><CardTitle>Master Parameter Registry</CardTitle><CardDescription>Central pool of parameters mapped to multiple UOMs.</CardDescription></div>
                <Dialog open={isParamOpen} onOpenChange={(open) => {
                  if(!open) {
                    setNewParam({ id: '', label: '', type: 'Numeric', options: [], uoms: [], defaultUom: '' });
                    setOptionInput('');
                  }
                  setIsParamOpen(open);
                }}>
                  {access.can_edit && <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-2"/> Add Parameter</Button></DialogTrigger>}
                  <DialogContent className="sm:max-w-[450px]">
                    <DialogHeader><DialogTitle>{newParam.id ? 'Edit Parameter' : 'Add New Parameter'}</DialogTitle></DialogHeader>
                    <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
                      <div className="space-y-2"><Label>Parameter Label *</Label><Input placeholder="e.g. Plant Height" value={newParam.label} onChange={e => setNewParam({...newParam, label: e.target.value})} /></div>
                      <div className="space-y-2">
                        <Label>Input Type *</Label>
                        <Select value={newParam.type} onValueChange={v => setNewParam({...newParam, type: v, uoms: [], defaultUom: ''})}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Numeric">Numeric (Numbers only)</SelectItem>
                            <SelectItem value="Dropdown Choice">Dropdown Choice</SelectItem>
                            <SelectItem value="Boolean">Boolean (Yes/No)</SelectItem>
                            <SelectItem value="Textarea">Textarea (Long text)</SelectItem>
                            <SelectItem value="Upload Image">Upload Image</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {newParam.type === 'Dropdown Choice' && (
                        <div className="space-y-3 animate-in fade-in bg-slate-50 p-4 border rounded-xl">
                          <Label className="text-xs font-bold uppercase text-slate-500">Define Dropdown Choices</Label>
                          <div className="flex gap-2">
                            <Input 
                              placeholder="Type an option and press Enter..." 
                              className="bg-white"
                              value={optionInput} 
                              onChange={e => setOptionInput(e.target.value)} 
                              onKeyDown={e => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleAddOption();
                                }
                              }}
                            />
                            <Button type="button" onClick={handleAddOption} className="shrink-0 shadow-sm">Add</Button>
                          </div>
                          
                          {newParam.options.length > 0 ? (
                            <div className="flex flex-wrap gap-2 mt-3 p-3 bg-white border rounded-md shadow-inner min-h-[60px]">
                              {newParam.options.map((opt, idx) => (
                                <Badge key={idx} variant="outline" className="bg-slate-50 flex items-center gap-1.5 pl-2 pr-1.5 py-1 text-sm font-normal">
                                  {opt}
                                  <div 
                                    className="cursor-pointer hover:bg-red-100 rounded-full p-1 transition-colors" 
                                    onClick={() => handleRemoveOption(idx)}
                                  >
                                    <Trash2 className="h-3 w-3 text-red-500" />
                                  </div>
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <div className="mt-3 p-4 bg-white border border-dashed rounded-md text-center text-xs text-muted-foreground">
                              No options added yet. Type above and click Add.
                            </div>
                          )}
                        </div>
                      )}

                      {newParam.type === 'Numeric' && (
                        <div className="space-y-4 bg-slate-50 p-4 border rounded-xl animate-in fade-in">
                          <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase text-slate-500">1. Allowed UOMs</Label>
                            <div className="grid grid-cols-2 gap-2 max-h-[140px] overflow-y-auto">
                              {uoms.map(u => (
                                <div key={u.id} className="flex items-center space-x-2 bg-white p-2 border rounded-md">
                                  <Checkbox 
                                    id={`p-uom-${u.id}`}
                                    checked={newParam.uoms.includes(u.id)} 
                                    onCheckedChange={(c) => {
                                      setNewParam(p => {
                                        const newUoms = c ? [...p.uoms, u.id] : p.uoms.filter(id => id !== u.id);
                                        const newDef = (c && p.defaultUom === '') ? u.id : (!newUoms.includes(p.defaultUom) ? '' : p.defaultUom);
                                        return { ...p, uoms: newUoms, defaultUom: newDef };
                                      });
                                    }} 
                                  />
                                  <Label htmlFor={`p-uom-${u.id}`} className="text-sm font-medium leading-none cursor-pointer truncate">{u.uom_name} ({u.uom_symbol})</Label>
                                </div>
                              ))}
                            </div>
                          </div>

                          {newParam.uoms.length > 0 && (
                            <div className="space-y-2 animate-in fade-in">
                              <Label className="text-xs font-bold uppercase text-slate-500">2. Default UOM Selection</Label>
                              <Select value={newParam.defaultUom} onValueChange={v => setNewParam({...newParam, defaultUom: v})}>
                                <SelectTrigger className="bg-white"><SelectValue placeholder="Select default UOM..." /></SelectTrigger>
                                <SelectContent>
                                  {uoms.filter(u => newParam.uoms.includes(u.id)).map(u => (
                                    <SelectItem key={u.id} value={u.id}>{u.uom_name} ({u.uom_symbol})</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
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
                        <TableCell><Badge variant="secondary" className={p.ui_input_type === 'Upload Image' ? 'bg-indigo-50 text-indigo-700' : ''}>{p.ui_input_type}</Badge></TableCell>
                        <TableCell className="text-muted-foreground text-xs">{p.ui_input_type === 'Dropdown Choice' ? JSON.stringify(p.options_data) : '—'}</TableCell>
                        <TableCell className="text-right pr-6">
                          <div className="flex justify-end items-center gap-1">
                            {p.ui_input_type === 'Numeric' && access.can_edit && (
                              <Button onClick={() => openUomMapping(p)} variant="outline" size="sm" className="text-primary text-xs h-7 mr-2">Map UOMs</Button>
                            )}
                            {access.can_edit && (
                              <>
                                <Button variant="ghost" size="icon" onClick={() => openEditParam(p)} className="h-8 w-8 text-slate-500 hover:bg-slate-100"><Edit2 className="h-4 w-4" /></Button>
                                <Button variant="ghost" size="icon" onClick={() => deleteMaster('master_parameters', p.id, p.parameter_label)} className="h-8 w-8 text-red-500 hover:bg-red-50"><Trash2 className="h-4 w-4" /></Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ==================== UOM TAB ==================== */}
          <TabsContent value="uom">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between bg-muted/20 border-b pb-4">
                <div><CardTitle>Units of Measurement (UOM)</CardTitle><CardDescription>Global registry of measurement units.</CardDescription></div>
                <Dialog open={isUomOpen} onOpenChange={setIsUomOpen}>
                {access.can_edit && <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-2"/> Add UOM</Button></DialogTrigger>}
                  <DialogContent>
                    <DialogHeader><DialogTitle>{newUom.id ? 'Edit UOM' : 'Add New UOM'}</DialogTitle></DialogHeader>
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
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-6">UOM Name</TableHead>
                      <TableHead>Symbol</TableHead>
                      <TableHead className="text-right pr-6">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {uoms.length === 0 && <TableRow><TableCell colSpan={3} className="text-center py-8">No UOMs defined yet.</TableCell></TableRow>}
                    {uoms.map(u => (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium pl-6">{u.uom_name}</TableCell>
                        <TableCell><Badge variant="outline" className="font-mono font-bold bg-slate-50">{u.uom_symbol}</Badge></TableCell>
                        <TableCell className="text-right pr-6">
                          <div className="flex justify-end gap-2">
                          {access.can_edit && (
                            <>
                              <Button variant="ghost" size="icon" onClick={() => openEditUom(u)} className="h-8 w-8 text-slate-500 hover:bg-slate-100"><Edit2 className="h-4 w-4" /></Button>
                              <Button variant="ghost" size="icon" onClick={() => deleteMaster('master_uom', u.id, u.uom_name)} className="h-8 w-8 text-red-500 hover:bg-red-50"><Trash2 className="h-4 w-4" /></Button>
                            </>
                          )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* ==================== SPREADSHEET SOP BUILDER TAB ==================== */}
          <TabsContent value="layout">
            <div className="grid grid-cols-1 gap-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-4">
                
                {/* 1. Target Crops */}
                <div className="bg-muted/20 p-5 rounded-xl border border-border/50 flex flex-col">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-sm text-foreground uppercase tracking-wider flex items-center gap-2">
                      <span className="bg-primary text-white h-5 w-5 rounded-full flex items-center justify-center text-[10px]">1</span> Target Crops
                    </h3>
                  </div>
                  <div className="space-y-4 flex-1">
                    <Select disabled={!access.can_edit} value={layoutCategory} onValueChange={(v) => { setLayoutCategory(v === 'ALL' ? '' : v); setLayoutCrops([]); }}>
                      <SelectTrigger className="bg-white"><SelectValue placeholder="Filter by Category..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">All Categories</SelectItem>
                        {uniqueCategories.map(c => <SelectItem key={c as string} value={c as string}>{c as string}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <div className="bg-white border rounded-md p-3 h-[150px] overflow-y-auto grid grid-cols-2 gap-2 shadow-inner">
                      {crops
                        .filter(c => layoutCategory === '' || layoutCategory === 'ALL' || c.crop_category === layoutCategory)
                        .map(c => {
                          // 🚀 FIXED: Identify if the crop is already assigned to a DIFFERENT group
                          const isAssignedElsewhere = allAssignedCropIds.includes(c.id) && !layoutCrops.includes(c.id);
                          return (
                            <div key={c.id} className={`flex items-center space-x-2 p-1 rounded ${isAssignedElsewhere ? 'opacity-50' : 'hover:bg-muted/50'}`}>
                              <Checkbox 
                                disabled={!access.can_edit || isAssignedElsewhere} 
                                id={`crop-${c.id}`} 
                                checked={layoutCrops.includes(c.id)} 
                                onCheckedChange={() => toggleLayoutCrop(c.id)} 
                              />
                              <Label htmlFor={`crop-${c.id}`} className={`text-xs font-medium truncate flex-1 ${isAssignedElsewhere ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                                {c.crop_name} {isAssignedElsewhere && <span className="text-[10px] text-red-500 font-bold ml-1">(Assigned)</span>}
                              </Label>
                            </div>
                          );
                      })}
                    </div>
                    <div className="flex justify-between items-center text-xs text-muted-foreground">
                      <span>{layoutCrops.length} selected</span>
                      {access.can_edit && <Button variant="ghost" size="sm" onClick={selectAllFilteredCrops} className="h-6 text-[10px]">Select All</Button>}
                    </div>
                  </div>
                </div>

                {/* 2. Crop Journey */}
                <div className="bg-muted/20 p-5 rounded-xl border border-border/50 flex flex-col h-full">
                  <h3 className="font-bold text-sm text-foreground uppercase tracking-wider mb-2 flex items-center gap-2">
                    <span className="bg-primary text-white h-5 w-5 rounded-full flex items-center justify-center text-[10px]">2</span> Crop Journey (Execution Order)
                  </h3>
                  <div className="flex-1 grid grid-cols-2 gap-4 mt-2">
                    <div className="bg-white border rounded-md p-3 h-[150px] overflow-y-auto flex flex-col gap-2 shadow-inner">
                      <Label className="text-[10px] font-bold text-muted-foreground uppercase">Available Stages</Label>
                      {stages.map(s => (
                        <div key={s.id} className="flex items-center space-x-2 p-1 rounded">
                          <Checkbox disabled={!access.can_edit} id={`stage-${s.id}`} checked={layoutStages.includes(s.id)} onCheckedChange={() => toggleLayoutStage(s.id)} />
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
                  {access.can_edit && <Button onClick={saveExecutionOrder} variant="outline" size="sm" className="mt-4 w-full bg-white">Lock Global Stage Order</Button>}
                </div>
              </div>

              {/* 3. SOP Spreadsheet Editor */}
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
                              <div className={`bg-white border rounded-lg shadow-sm overflow-hidden ${!access.can_edit ? 'pointer-events-none opacity-90' : ''}`}>
                                <div className="bg-muted/30 px-4 py-3 border-b flex justify-between items-center">
                                  <h4 className="text-sm font-bold flex items-center gap-2"><FlaskConical className="h-4 w-4 text-primary" /> Application Schedule</h4>
                                  {access.can_edit && <Button size="sm" onClick={addApplicationRow} className="h-7 text-xs gap-1"><Plus className="h-3 w-3"/> Add Application Row</Button>}
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
                                              {access.can_edit && <Button variant="ghost" size="icon" onClick={() => removeAppRow(index)} className="h-7 w-7 text-red-500 hover:bg-red-50"><Trash2 className="h-3 w-3" /></Button>}
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
                                <Card className={`border-border shadow-sm ${!access.can_edit ? 'pointer-events-none opacity-90' : ''}`}>
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
                                <Card className={`border-border shadow-sm ${!access.can_edit ? 'pointer-events-none opacity-90' : ''}`}>
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

                              {access.can_edit && (
                                <div className="flex justify-end pt-4 border-t">
                                  <Button onClick={saveActiveStageSop} disabled={savingSop} className="px-8 shadow-md text-sm gap-2 h-10">
                                    {savingSop ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                    Save {stage?.stage_name} Data For {layoutCrops.length} Crop(s)
                                  </Button>
                                </div>
                              )}
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
          
          {/* FULL EXCEL-STYLE CROP SOP VIEWER DIALOG */}
          <Dialog open={isSopViewOpen} onOpenChange={setIsSopViewOpen}>
            <DialogContent className="max-w-[95vw] w-full max-h-[90vh] flex flex-col p-0 overflow-hidden">
              <DialogHeader className="px-6 py-4 border-b bg-muted/10 shrink-0">
                <DialogTitle className="flex items-center gap-2 text-xl">
                  <CheckSquare className="h-5 w-5 text-primary" /> SOP Format View: <span className="text-primary font-bold">{viewCrop?.crop_name}</span>
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
                          const apps = stage.sop_applications.length > 0 ? stage.sop_applications : [{}]; 
                          const rowSpan = apps.length;
                          const paramText = stage.sop_parameters.length > 0 
                            ? stage.sop_parameters.map((p: any, i: number) => `${i + 1}. ${p.master_parameters.parameter_label} ${p.is_mandatory ? '(Req)' : ''}`).join('\n')
                            : '--';

                          return apps.map((app: any, idx: number) => (
                            <TableRow key={`${stage.id}-${idx}`} className="hover:bg-transparent">
                              {idx === 0 && <TableCell rowSpan={rowSpan} className="border border-slate-200 bg-slate-50 font-bold align-top whitespace-pre-wrap">{stage.master_crop_stages?.stage_name}</TableCell>}
                              
                              <TableCell className="border border-slate-200 align-top">{app.application_type || '--'}</TableCell>
                              <TableCell className="border border-slate-200 align-top">{app.das ?? '--'}</TableCell>
                              <TableCell className="border border-slate-200 align-top whitespace-pre-wrap">{app.application_method || '--'}</TableCell>
                              <TableCell className="border border-slate-200 align-top font-bold text-primary">{app.master_gls_products?.product_name || '--'}</TableCell>
                              <TableCell className="border border-slate-200 align-top">{app.dosage_value || '--'}</TableCell>
                              <TableCell className="border border-slate-200 align-top whitespace-pre-wrap">{app.benefit || '--'}</TableCell>
                              <TableCell className="border border-slate-200 align-top whitespace-pre-wrap">{app.impact || '--'}</TableCell>
                              
                              {idx === 0 && <TableCell rowSpan={rowSpan} className="border border-slate-200 bg-slate-50 align-top whitespace-pre-wrap">{stage.chemical_recommendation_and_dosage || '--'}</TableCell>}
                              
                              <TableCell className="border border-slate-200 align-top whitespace-pre-wrap">{app.chemical_name || '--'}</TableCell>
                              <TableCell className="border border-slate-200 align-top">{app.chemical_dosage || '--'}</TableCell>
                              
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
        </Tabs>
      </div>
    </AppLayout>
  );
}