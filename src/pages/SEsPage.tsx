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
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
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
    if (!name.trim()) return;
    setSaving(true);
    const { error } = await supabase.from('profiles').insert({
      name: name.trim(),
      mobile: mobile.trim() || null,
      email: email.trim() || null,
      role: 'SE',
    });
    setSaving(false);
    if (error) {
      toast({ title: 'Could not create SE', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Sales Executive created' });
    setName(''); setMobile(''); setEmail('');
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
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Sales Executive</DialogTitle>
              <DialogDescription>
                The SE will complete their full profile from the mobile app.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-3 pt-2">
              <div className="space-y-2">
                <Label htmlFor="se-name">Name *</Label>
                <Input id="se-name" value={name} onChange={e => setName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="se-mobile">Mobile</Label>
                <Input id="se-mobile" value={mobile} onChange={e => setMobile(e.target.value)} placeholder="+91 ..." />
              </div>
              <div className="space-y-2">
                <Label htmlFor="se-email">Email</Label>
                <Input id="se-email" type="email" value={email} onChange={e => setEmail(e.target.value)} />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Create SE
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
