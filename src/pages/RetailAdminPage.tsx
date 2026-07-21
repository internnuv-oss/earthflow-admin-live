import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import AppLayout from '@/components/AppLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Store, PackagePlus, ArrowRightLeft, ShieldCheck, Loader2, ExternalLink, Shield } from 'lucide-react';

export default function RetailAdminPage({ onLogout }: { onLogout: () => void }) {
  const { session, loading: authLoading } = useAuth();
  const userId = session?.user?.id;
  const { getModulePerm, loading: permLoading } = usePermissions(userId || '');
  const retailAccess = getModulePerm('retail');
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);

  // Data States
  const [items, setItems] = useState<any[]>([]);
  const [executives, setExecutives] = useState<any[]>([]);
  const [ledgers, setLedgers] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);

  // Modal & Form States
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [newItem, setNewItem] = useState({ name: '', mrp: '', uom: 'Bag' });
  const [transferData, setTransferData] = useState({ se_id: '', item_id: '', qty: '', batch_number: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (userId && retailAccess.can_view) {
      fetchAllData();
    }
  }, [userId, retailAccess.can_view]);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [itemsRes, seRes, ledgerRes, ordersRes] = await Promise.all([
        supabase.from('item_master').select('*').order('name'),
        supabase.from('profiles').select('id, name').eq('role', 'SE').eq('is_demo', false).order('name'),
        supabase.from('inventory_transactions').select('*, profiles(name), item_master(name)').order('created_at', { ascending: false }).limit(100),
        supabase.from('retail_orders').select('*, profiles(name)').order('created_at', { ascending: false }).limit(100)
      ]);

      if (itemsRes.data) setItems(itemsRes.data);
      if (seRes.data) setExecutives(seRes.data);
      if (ledgerRes.data) setLedgers(ledgerRes.data);
      if (ordersRes.data) setOrders(ordersRes.data);
    } catch (err: any) {
      toast({ title: 'Error fetching data', description: err.message, variant: 'destructive' });
    }
    setLoading(false);
  };

  const handleCreateItem = async () => {
    if (!newItem.name || !newItem.mrp) return toast({ title: 'Missing Fields', variant: 'destructive' });
    setIsSubmitting(true);
    
    const { error } = await supabase.from('item_master').insert({
      name: newItem.name,
      mrp: parseFloat(newItem.mrp),
      uom: newItem.uom
    });

    setIsSubmitting(false);
    if (error) {
      toast({ title: 'Failed to create item', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Item Created Successfully' });
      setIsItemModalOpen(false);
      setNewItem({ name: '', mrp: '', uom: 'Bag' });
      fetchAllData();
    }
  };

  const handleStockTransfer = async () => {
    if (!transferData.se_id || !transferData.item_id || !transferData.qty || !transferData.batch_number.trim()) {
      return toast({ title: 'Missing Fields', description: 'Please fill all fields including Batch Number.', variant: 'destructive' });
    }
    setIsSubmitting(true);

    const { error } = await supabase.rpc('admin_transfer_stock', {
      p_se_id: transferData.se_id,
      p_item_id: transferData.item_id,
      p_qty: parseInt(transferData.qty, 10),
      p_batch_number: transferData.batch_number.trim()
    });

    setIsSubmitting(false);
    if (error) {
      toast({ title: 'Transfer Failed', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Stock Transferred Successfully' });
      setIsTransferModalOpen(false);
      setTransferData({ se_id: '', item_id: '', qty: '', batch_number: '' });
      fetchAllData(); 
    }
  };

  if (authLoading || permLoading) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!retailAccess.can_view) {
    return (
      <AppLayout onLogout={onLogout}>
        <div className="flex flex-col items-center justify-center h-[60vh] text-center">
          <Shield className="h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold">Access Denied</h2>
          <p className="text-muted-foreground">You do not have permission to view Retail & Inventory.</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout onLogout={onLogout}>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Retail & Inventory</h2>
          <p className="text-sm text-muted-foreground">Manage catalog, distribute stock, and audit retail payments.</p>
        </div>
        
        {retailAccess.can_edit && (
          <div className="flex gap-2">
            <Button onClick={() => setIsItemModalOpen(true)} variant="outline" className="gap-2">
              <Store className="h-4 w-4" /> Add New Item
            </Button>
            <Button onClick={() => setIsTransferModalOpen(true)} className="gap-2">
              <PackagePlus className="h-4 w-4" /> Assign Stock to SE
            </Button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex h-[40vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : (
        <Tabs defaultValue="catalog" className="w-full">
          <TabsList className="w-full justify-start border-b rounded-none bg-transparent h-auto p-0 gap-6 mb-6 overflow-x-auto">
            <TabsTrigger value="catalog" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none py-3 px-1 bg-transparent data-[state=active]:shadow-none"><Store className="h-4 w-4 mr-2"/> Item Catalog</TabsTrigger>
            <TabsTrigger value="ledgers" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none py-3 px-1 bg-transparent data-[state=active]:shadow-none"><ArrowRightLeft className="h-4 w-4 mr-2"/> Stock Ledgers</TabsTrigger>
            <TabsTrigger value="orders" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none py-3 px-1 bg-transparent data-[state=active]:shadow-none"><ShieldCheck className="h-4 w-4 mr-2"/> Retail Orders & UPI Audit</TabsTrigger>
          </TabsList>

          {/* ITEM CATALOG TAB */}
          <TabsContent value="catalog" className="mt-0">
            <div className="bg-white border rounded-lg shadow-sm overflow-hidden">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted text-muted-foreground font-medium border-b">
                  <tr>
                    <th className="px-4 py-3">Product Name</th>
                    <th className="px-4 py-3">MRP (₹)</th>
                    <th className="px-4 py-3">UOM</th>
                    <th className="px-4 py-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {items.map((item) => (
                    <tr key={item.id} className="hover:bg-muted/20">
                      <td className="px-4 py-3 font-bold">{item.name}</td>
                      <td className="px-4 py-3 font-semibold text-slate-700">₹{item.mrp.toFixed(2)}</td>
                      <td className="px-4 py-3">{item.uom}</td>
                      <td className="px-4 py-3 text-right">
                        <Badge variant={item.is_active ? 'default' : 'secondary'} className={item.is_active ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100' : ''}>
                          {item.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                  {items.length === 0 && <tr><td colSpan={4} className="text-center py-8 text-muted-foreground">No items in the catalog.</td></tr>}
                </tbody>
              </table>
            </div>
          </TabsContent>

          {/* STOCK LEDGERS TAB */}
          <TabsContent value="ledgers" className="mt-0">
            <div className="bg-white border rounded-lg shadow-sm overflow-hidden">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted text-muted-foreground font-medium border-b">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Executive</th>
                    <th className="px-4 py-3">Product</th>
                    <th className="px-4 py-3">Batch No.</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Quantity</th>
                    <th className="px-4 py-3">Reference (Invoice)</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {ledgers.map((log) => (
                    <tr key={log.id} className="hover:bg-muted/20">
                      <td className="px-4 py-3 text-muted-foreground">{new Date(log.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</td>
                      <td className="px-4 py-3 font-semibold">{log.profiles?.name || 'Unknown SE'}</td>
                      <td className="px-4 py-3 font-bold">{log.item_master?.name}</td>
                      <td className="px-4 py-3 font-mono text-xs">{log.batch_number || 'N/A'}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={log.txn_type === 'IN' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-orange-50 text-orange-700 border-orange-200'}>
                          {log.txn_type === 'IN' ? 'STOCK ASSIGNED' : 'STOCK SOLD (OUT)'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 font-bold text-base">{log.txn_type === 'IN' ? '+' : '-'}{log.qty}</td>
                      <td className="px-4 py-3 font-mono text-xs">{log.reference_id}</td>
                    </tr>
                  ))}
                  {ledgers.length === 0 && <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">No stock transactions found.</td></tr>}
                </tbody>
              </table>
            </div>
          </TabsContent>

          {/* ORDERS & UPI AUDIT TAB */}
          <TabsContent value="orders" className="mt-0">
            <div className="bg-white border rounded-lg shadow-sm overflow-hidden">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted text-muted-foreground font-medium border-b">
                  <tr>
                    <th className="px-4 py-3">Invoice No & Date</th>
                    <th className="px-4 py-3">Sold By (SE)</th>
                    <th className="px-4 py-3">Farmer Details</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Payment Mode</th>
                    <th className="px-4 py-3 text-center">Audit Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {orders.map((order) => (
                    <tr key={order.id} className="hover:bg-muted/20">
                      <td className="px-4 py-3">
                        <span className="font-bold text-primary block">{order.invoice_no}</span>
                        <span className="text-xs text-muted-foreground">{new Date(order.created_at).toLocaleDateString()}</span>
                      </td>
                      <td className="px-4 py-3 font-medium">{order.profiles?.name || 'Unknown'}</td>
                      <td className="px-4 py-3">
                        <span className="font-semibold block">{order.farmer_name}</span>
                        <span className="text-xs text-muted-foreground">{order.farmer_mobile}</span>
                      </td>
                      <td className="px-4 py-3 font-bold text-base">₹{order.total_amount}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={order.payment_mode === 'UPI' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-amber-50 text-amber-700 border-amber-200'}>
                          {order.payment_mode}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-2">
                          {order.pdf_url && (
                            <Button size="sm" variant="outline" onClick={() => window.open(order.pdf_url, '_blank')} className="h-7 text-xs">
                              Invoice <ExternalLink className="h-3 w-3 ml-1" />
                            </Button>
                          )}
                          {order.payment_mode === 'UPI' && order.payment_proof_url && (
                            <Button size="sm" variant="default" onClick={() => window.open(order.payment_proof_url, '_blank')} className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700">
                              View UPI Proof <ExternalLink className="h-3 w-3 ml-1" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {orders.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">No retail orders found.</td></tr>}
                </tbody>
              </table>
            </div>
          </TabsContent>
        </Tabs>
      )}

      {/* CREATE ITEM MODAL */}
      <Dialog open={isItemModalOpen} onOpenChange={setIsItemModalOpen}>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Add Item to Catalog</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Product Name *</label>
              <Input placeholder="e.g. Bioshot Extra 1Kg" value={newItem.name} onChange={(e) => setNewItem({...newItem, name: e.target.value})} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">MRP (₹) *</label>
                <Input type="number" placeholder="0.00" value={newItem.mrp} onChange={(e) => setNewItem({...newItem, mrp: e.target.value})} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Unit of Measure</label>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={newItem.uom} onChange={(e) => setNewItem({...newItem, uom: e.target.value})}>
                  <option value="Bag">Bag</option>
                  <option value="Bottle">Bottle</option>
                  <option value="Pouch">Pouch</option>
                  <option value="Box">Box</option>
                  <option value="Kg">Kg</option>
                  <option value="Ltr">Ltr</option>
                </select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsItemModalOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateItem} disabled={isSubmitting}>{isSubmitting ? <Loader2 className="animate-spin h-4 w-4" /> : 'Save Item'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* STOCK TRANSFER MODAL */}
      <Dialog open={isTransferModalOpen} onOpenChange={setIsTransferModalOpen}>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Assign Stock to Executive</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Select Executive *</label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={transferData.se_id} onChange={(e) => setTransferData({...transferData, se_id: e.target.value})}>
                <option value="">-- Choose Executive --</option>
                {executives.map(se => <option key={se.id} value={se.id}>{se.name}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Select Product *</label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={transferData.item_id} onChange={(e) => setTransferData({...transferData, item_id: e.target.value})}>
                <option value="">-- Choose Product --</option>
                {items.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Batch Number *</label>
                <Input type="text" placeholder="e.g. BATCH-001" value={transferData.batch_number} onChange={(e) => setTransferData({...transferData, batch_number: e.target.value})} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Quantity to Assign *</label>
                <Input type="number" placeholder="Enter quantity" value={transferData.qty} onChange={(e) => setTransferData({...transferData, qty: e.target.value})} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsTransferModalOpen(false)}>Cancel</Button>
            <Button onClick={handleStockTransfer} disabled={isSubmitting}>{isSubmitting ? <Loader2 className="animate-spin h-4 w-4" /> : 'Transfer Stock'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}