import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth'; 
import { usePermissions } from '@/hooks/usePermissions'; 
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Loader2, Shield } from 'lucide-react'; 
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import SETable, { SERow } from '@/components/SETable';
import SEDetailSheet from '@/components/SEDetailSheet';

interface SEsPageProps { onLogout: () => void; }

const SEsPage = ({ onLogout }: SEsPageProps) => {
  const [rows, setRows] = useState<SERow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Form State matching the mobile app registration fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dob, setDob] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [selected, setSelected] = useState<SERow | null>(null);
  const { toast } = useToast();

  // Fetch dynamic user details and module permissions
  const { session, loading: authLoading } = useAuth();
  const { getModulePerm, loading: permLoading } = usePermissions(session?.user?.id || '');
  const seAccess = getModulePerm('sales_executives'); 

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, mobile, email, role, created_at, sales_executive(is_profile_complete, personal_details, organization_details, financial_details, assets_details, documents)')
        .eq('role', 'SE')
        .order('created_at', { ascending: false });
      
      if (error) {
        toast({ title: 'Failed to load', description: error.message, variant: 'destructive' });
      } else {
        setRows(((data || []) as any[]).map(r => ({
          ...r,
          sales_executive: Array.isArray(r?.sales_executive) ? r.sales_executive[0] : r?.sales_executive,
        })));
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { 
    if (!authLoading && !permLoading && seAccess.can_view) {
      load(); 
    }
  }, [authLoading, permLoading, seAccess.can_view]);

  // ==========================================
  // SAFE EARLY RETURNS FOR AUTH / PERMISSIONS
  // ==========================================
  if (authLoading || permLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!seAccess.can_view) {
    return (
      <AppLayout onLogout={onLogout}>
        <div className="flex flex-col items-center justify-center h-[60vh] text-center">
          <Shield className="h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold">Access Denied</h2>
          <p className="text-muted-foreground">You do not have permission to view Sales Executives.</p>
        </div>
      </AppLayout>
    );
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !mobile.trim() || !password.trim()) {
      toast({ title: 'Validation Error', description: 'Please fill all required fields.', variant: 'destructive' });
      return;
    }
    
    setSaving(true);

    // 🚀 Grab the session to bypass the "Missing authorization header" error
    const { data: { session } } = await supabase.auth.getSession();
    
    // Combine first and last name
    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
    
    // Invoke the secure Edge Function
    const { data, error } = await supabase.functions.invoke('create-se', {
      body: {
        name: fullName,       // 🚀 FIX 1: Send 'name' instead of 'firstName'
        mobile: mobile.trim(),
        email: email.trim(),
        password: password,
        role: 'SE'            // 🚀 FIX 2: Explicitly tell the Edge Function this is an 'SE'
      },
      headers: {
        Authorization: `Bearer ${session?.access_token}` // 🚀 FIX 3: Inject Auth Header
      }
    });

    setSaving(false);
    
    if (error || data?.error) {
      toast({ title: 'Could not create SE', description: error?.message || data?.error, variant: 'destructive' });
      return;
    }

    toast({ title: 'Sales Executive created', description: 'They can now log into the mobile app.' });
    
    // Reset form
    setFirstName(''); setLastName(''); setDob(''); setMobile(''); setEmail(''); setPassword('');
    setOpen(false);
    load();
  };

  return (
    <AppLayout onLogout={onLogout}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold mb-1">Sales Executives</h2>
          <p className="text-sm text-muted-foreground">
            {(rows || []).length} total. Manage onboarding agents in your territory.
          </p>
        </div>

        {/* HIDDEN / SHOWN DYNAMICALLY DEPENDING ON EDIT PERMISSION */}
        {seAccess.can_edit && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="h-4 w-4" /> Add New SE</Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Register Sales Executive</DialogTitle>
                <DialogDescription>
                  Create credentials for the SE to log into the mobile app.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4 pt-2">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name *</Label>
                    <Input id="firstName" value={firstName} onChange={e => setFirstName(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input id="lastName" value={lastName} onChange={e => setLastName(e.target.value)} />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="dob">Date of Birth (DD-MM-YYYY)</Label>
                  <Input id="dob" placeholder="15-08-1995" value={dob} onChange={e => setDob(e.target.value)} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="se-mobile">Mobile Number *</Label>
                  <Input id="se-mobile" value={mobile} onChange={e => setMobile(e.target.value)} placeholder="10-digit number" required maxLength={10} />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="se-email">Email Address</Label>
                  <Input id="se-email" type="email" value={email} onChange={e => setEmail(e.target.value)} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Temporary Password *</Label>
                  <Input id="password" type="text" value={password} onChange={e => setPassword(e.target.value)} placeholder="Minimum 6 characters" required minLength={6} />
                </div>

                <DialogFooter className="pt-4">
                  <Button type="submit" disabled={saving} className="w-full">
                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Register SE
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="mt-4">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <SETable 
            rows={rows} 
            onSelect={setSelected} 
            canEdit={seAccess.can_edit} 
          />
        )}
      </div>

      <SEDetailSheet 
        se={selected} 
        open={!!selected} 
        onClose={() => setSelected(null)} 
        canEdit={seAccess.can_edit} 
      />
    </AppLayout>
  );
};

export default SEsPage;