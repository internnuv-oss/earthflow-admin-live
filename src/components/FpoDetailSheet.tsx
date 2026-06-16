import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter, SheetDescription } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FileText, Edit, Save, X, Loader2 } from 'lucide-react';
import { KeyValueGrid, Section } from '@/lib/jsonViewer';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { FpoRow } from './FpoTable';

interface Props { 
  fpo: FpoRow | null; 
  open: boolean; 
  onClose: () => void;
  onSaved?: () => void;
}

const FpoDetailSheet = ({ fpo: f, open, onClose, onSaved }: Props) => {
  const { toast } = useToast();
  
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form State
  const [fpoName, setFpoName] = useState('');
  const [contactMobile, setContactMobile] = useState('');
  const [email, setEmail] = useState('');
  const [regNo, setRegNo] = useState('');
  const [incYear, setIncYear] = useState('');
  const [ceoName, setCeoName] = useState('');
  const [presidentName, setPresidentName] = useState('');
  const [gst, setGst] = useState('');
  const [pan, setPan] = useState('');
  const [address, setAddress] = useState('');
  const [loc, setLoc] = useState({ state: '', city: '', taluka: '', pincode: '' });
  const [promotingAgency, setPromotingAgency] = useState('');
  const [commandArea, setCommandArea] = useState('');

  useEffect(() => {
    if (f && open) {
      setFpoName(f.fpo_name || '');
      setContactMobile(f.contact_mobile || '');
      setEmail(f.email || '');
      setRegNo(f.registration_number || '');
      setIncYear(f.incorporation_year || '');
      setCeoName(f.ceo_name || '');
      setPresidentName(f.bod_president_name || '');
      setGst(f.gst_number || '');
      setPan(f.pan_number || '');
      setAddress(f.address || '');
      setPromotingAgency(f.promoting_agency || '');
      setCommandArea(f.command_area || '');
      
      setLoc({ 
        state: f.state || '', 
        city: f.city || '', 
        taluka: f.taluka || '', 
        pincode: f.pincode || '' 
      });
    }
  }, [f, open, isEditing]);

  const handleSave = async () => {
    if (!f) return;
    
    if (!fpoName || fpoName.length < 2) return toast({ title: "Error", description: "FPO Name is required.", variant: "destructive" });
    if (!/^\d{10}$/.test(contactMobile)) return toast({ title: "Error", description: "Mobile must be 10 digits.", variant: "destructive" });
    
    setSaving(true);
    const historyEntry = { timestamp: new Date().toISOString(), action: 'Admin Edited Profile', updated_status: f.status };
    const update_history = [...(f.update_history || []), historyEntry];

    const payload = {
      fpo_name: fpoName,
      contact_mobile: contactMobile,
      email,
      registration_number: regNo,
      incorporation_year: incYear,
      ceo_name: ceoName,
      bod_president_name: presidentName,
      gst_number: gst,
      pan_number: pan,
      address,
      state: loc.state,
      city: loc.city,
      taluka: loc.taluka,
      pincode: loc.pincode,
      promoting_agency: promotingAgency,
      command_area: commandArea,
      update_history
    };

    if (f.status === 'DRAFT') {
      const draft_data = {
        fpoName, contactMobile, email, registrationNumber: regNo, incorporationYear: incYear,
        ceoName, bodPresidentName: presidentName, gstNumber: gst, panNumber: pan,
        address, state: loc.state, city: loc.city, taluka: loc.taluka, pincode: loc.pincode,
        promotingAgency, commandArea,
        bankAccounts: f.bank_details?.bankAccounts || [],
        documents: f.documents || {}
      };

      const { error } = await (supabase as any)
        .from('drafts')
        .update({ draft_data, updated_at: new Date().toISOString(), update_history })
        .or(`id.eq.${f.id},entity_id.eq.${f.id}`);

      setSaving(false);
      if (error) return toast({ title: 'Failed to save', description: error.message, variant: 'destructive' });
      toast({ title: 'Success', description: 'Draft updated.' });
      setIsEditing(false);
      if (onSaved) onSaved(); 
      onClose();
      return;
    }

    const { error } = await (supabase as any).from('fpos').update(payload).eq('id', f.id);
    setSaving(false);
    if (error) return toast({ title: 'Failed to save', description: error.message, variant: 'destructive' });
    toast({ title: 'Success', description: 'FPO updated.' });
    setIsEditing(false);
    if (onSaved) onSaved(); 
    onClose();
  };

  if (!f) return null;

  return (
    <Sheet open={open} onOpenChange={o => { if (!o) { setIsEditing(false); onClose(); } }}>
      <SheetContent side="right" className="w-full sm:max-w-2xl lg:max-w-4xl p-0 flex flex-col bg-slate-50/50">
        <SheetHeader className="px-6 py-5 border-b border-border space-y-4 bg-background">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              {isEditing ? (
                <div className="space-y-1 mb-2">
                  <Label className="text-xs text-muted-foreground">FPO Name *</Label>
                  <Input value={fpoName} onChange={e => setFpoName(e.target.value)} className="text-lg font-bold h-9 w-full max-w-sm" />
                </div>
              ) : (
                <>
                  <SheetTitle className="text-xl truncate">{f?.fpo_name || 'FPO'}</SheetTitle>
                  <SheetDescription className="sr-only">FPO Details</SheetDescription> 
                </>
              )}
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                <span>{f?.city || 'No District'}</span>
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
        </SheetHeader>

        <Tabs defaultValue="basic" className="flex-1 flex flex-col min-h-0">
          <TabsList className="mx-6 mt-4 flex flex-wrap h-auto gap-2 bg-background border shadow-sm">
            <TabsTrigger value="basic">Basic Info</TabsTrigger>
            <TabsTrigger value="eval">Evaluations</TabsTrigger>
          </TabsList>
          
          <ScrollArea className="flex-1 mt-3">
            <div className="px-6 pb-8">
              
              <TabsContent value="basic" className="space-y-4 mt-0">
                <Section title="General Information">
                  {isEditing ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5"><Label>Registration Number</Label><Input value={regNo} onChange={e => setRegNo(e.target.value)} /></div>
                      <div className="space-y-1.5"><Label>Inc. Year</Label><Input value={incYear} maxLength={4} onChange={e => setIncYear(e.target.value)} /></div>
                      <div className="space-y-1.5"><Label>CEO Name</Label><Input value={ceoName} onChange={e => setCeoName(e.target.value)} /></div>
                      <div className="space-y-1.5"><Label>BOD President</Label><Input value={presidentName} onChange={e => setPresidentName(e.target.value)} /></div>
                      <div className="space-y-1.5"><Label>Contact Mobile *</Label><Input value={contactMobile} maxLength={10} type="tel" onChange={e => setContactMobile(e.target.value)} /></div>
                      <div className="space-y-1.5"><Label>Email</Label><Input value={email} type="email" onChange={e => setEmail(e.target.value)} /></div>
                      
                      <div className="space-y-1.5"><Label>State *</Label><Input value={loc.state} onChange={e => setLoc(p => ({...p, state: e.target.value}))} /></div>
                      <div className="space-y-1.5"><Label>District *</Label><Input value={loc.city} onChange={e => setLoc(p => ({...p, city: e.target.value}))} /></div>
                      <div className="space-y-1.5"><Label>Taluka *</Label><Input value={loc.taluka} onChange={e => setLoc(p => ({...p, taluka: e.target.value}))} /></div>
                      <div className="space-y-1.5"><Label>Pincode</Label><Input value={loc.pincode} maxLength={6} type="tel" onChange={e => setLoc(p => ({...p, pincode: e.target.value}))} /></div>
                      
                      <div className="space-y-1.5 sm:col-span-2"><Label>Full Address</Label><Input value={address} onChange={e => setAddress(e.target.value)} /></div>
                      
                      <div className="space-y-1.5"><Label>Promoting Agency</Label><Input value={promotingAgency} onChange={e => setPromotingAgency(e.target.value)} /></div>
                      <div className="space-y-1.5"><Label>Command Area</Label><Input value={commandArea} onChange={e => setCommandArea(e.target.value)} /></div>
                      <div className="space-y-1.5"><Label>GST Number</Label><Input value={gst} maxLength={15} onChange={e => setGst(e.target.value.toUpperCase())} /></div>
                      <div className="space-y-1.5"><Label>PAN Number</Label><Input value={pan} maxLength={10} onChange={e => setPan(e.target.value.toUpperCase())} /></div>
                    </div>
                  ) : (
                    <KeyValueGrid data={{ 
                      'Reg Number': f.registration_number, 'Inc Year': f.incorporation_year, 'CEO': f.ceo_name,
                      'President': f.bod_president_name, 'Mobile': f.contact_mobile, 'Email': f.email,
                      'Address': f.address, 'State': f.state, 'District': f.city, 'Taluka': f.taluka,
                      'Promoting Agency': f.promoting_agency, 'Command Area': f.command_area,
                      'GST': f.gst_number, 'PAN': f.pan_number 
                    }} />
                  )}
                </Section>
              </TabsContent>

              <TabsContent value="eval" className="space-y-4 mt-0">
                 <Section title="Read Only Arrays & Evaluations">
                   <p className="text-sm text-muted-foreground mb-4">View structural data points submitted by the SE.</p>
                   <KeyValueGrid data={{ ...f.member_base, ...f.business_scope, ...f.scoring, 'Total Score': f.total_score }} />
                 </Section>
              </TabsContent>

            </div>
          </ScrollArea>
        </Tabs>

        {isEditing && (
          <SheetFooter className="px-6 py-4 border-t border-border bg-muted/20 mt-auto">
            <div className="flex w-full justify-end gap-3">
              <Button variant="ghost" onClick={() => setIsEditing(false)} disabled={saving}><X className="h-4 w-4 mr-2" /> Cancel</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />} Save Changes
              </Button>
            </div>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default FpoDetailSheet;