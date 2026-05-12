import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Loader2 } from 'lucide-react';
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
  
  // New Form State matching the mobile app registration fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dob, setDob] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [selected, setSelected] = useState<SERow | null>(null);
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('id, name, mobile, email, role, created_at, sales_executive(is_profile_complete, personal_details, organization_details, financial_details, assets_details, documents)')
      .eq('role', 'SE')
      .order('created_at', { ascending: false });
    
    if (error) toast({ title: 'Failed to load', description: error.message, variant: 'destructive' });
    
    setRows(((data || []) as any[]).map(r => ({
      ...r,
      sales_executive: Array.isArray(r?.sales_executive) ? r.sales_executive[0] : r?.sales_executive,
    })));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !mobile.trim() || !password.trim()) {
      toast({ title: 'Validation Error', description: 'Please fill all required fields.', variant: 'destructive' });
      return;
    }
    
    setSaving(true);
    
    // Invoke the secure Edge Function to create the Auth User + DB records
    const { data, error } = await supabase.functions.invoke('create-se', {
      body: {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        dob: dob.trim(),
        mobile: mobile.trim(),
        email: email.trim(),
        password: password
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
      </div>

      <div className="mt-4">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <SETable rows={rows} onSelect={setSelected} />
        )}
      </div>

      <SEDetailSheet se={selected} open={!!selected} onClose={() => setSelected(null)} />
    </AppLayout>
  );
};

export default SEsPage;