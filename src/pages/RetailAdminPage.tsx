import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import AppLayout from '@/components/AppLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import DataTable, { DataTableColumn, DataTableFilter } from '@/components/DataTable';
import { Store, PackagePlus, ArrowRightLeft, ShieldCheck, Loader2, ExternalLink, Shield, Edit2, Trash2 } from 'lucide-react';

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
  const [isEditItemModalOpen, setIsEditItemModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  
  const [newItem, setNewItem] = useState({ name: '', mrp: '', uom: 'Bag' });
  const [editingItem, setEditingItem] = useState<any>(null);
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
        supabase.from('inventory_transactions').select('*, profiles(name), item_master(name)').order('created_at', { ascending: false }).limit(500),
        supabase.from('retail_orders').select('*, profiles(name)').order('created_at', { ascending: false }).limit(500)
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

  // --- ITEM CRUD HANDLERS ---
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

  const handleUpdateItem = async () => {
    if (!editingItem.name || !editingItem.mrp) return toast({ title: 'Missing Fields', variant: 'destructive' });
    setIsSubmitting(true);

    const { error } = await supabase.from('item_master').update({
      name: editingItem.name,
      mrp: parseFloat(editingItem.mrp),
      uom: editingItem.uom,
      is_active: editingItem.is_active
    }).eq('id', editingItem.id);

    setIsSubmitting(false);
    if (error) {
      toast({ title: 'Update Failed', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Item Updated Successfully' });
      setIsEditItemModalOpen(false);
      setEditingItem(null);
      fetchAllData();
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (!confirm("Are you sure you want to delete this item?")) return;
    
    const { error } = await supabase.from('item_master').delete().eq('id', id);
    
    if (error) {
      // Catch Foreign Key violations to protect ledgers
      if (error.code === '23503') {
        toast({ 
          title: 'Cannot Delete Item', 
          description: 'This item has already been assigned to executives or sold. Please EDIT it and toggle the status to "Inactive" instead.', 
          variant: 'destructive' 
        });
      } else {
        toast({ title: 'Delete Failed', description: error.message, variant: 'destructive' });
      }
    } else {
      toast({ title: 'Item Deleted' });
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

  // --- DATATABLE CONFIGURATIONS ---

  // 1. Catalog Columns & Filters
  const catalogColumns: DataTableColumn<any>[] = useMemo(() => [
    { key: 'name', header: 'Product Name', sortable: true, sortValue: r => r.name, accessor: r => <span className="font-bold">{r.name}</span> },
    { key: 'mrp', header: 'MRP (₹)', sortable: true, sortValue: r => r.mrp, accessor: r => <span className="font-semibold text-slate-700">₹{r.mrp.toFixed(2)}</span> },
    { key: 'uom', header: 'UOM', sortable: true, sortValue: r => r.uom, accessor: r => r.uom },
    { 
      key: 'status', header: 'Status', sortable: true, sortValue: r => r.is_active ? 1 : 0, 
      accessor: r => (
        <Badge variant={r.is_active ? 'default' : 'secondary'} className={r.is_active ? 'bg-emerald-100 text-emerald-800' : ''}>
          {r.is_active ? 'Active' : 'Inactive'}
        </Badge>
      ) 
    },
    { 
      key: 'actions', header: 'Actions', headerClassName: 'text-right', className: 'text-right',
      accessor: r => retailAccess.can_edit ? (
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => { setEditingItem(r); setIsEditItemModalOpen(true); }}>
            <Edit2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteItem(r.id)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ) : null
    }
  ], [retailAccess.can_edit]);

  const catalogFilters: DataTableFilter<any>[] = useMemo(() => [
    { key: 'status', label: 'Status', options: [{ value: 'Active', label: 'Active' }, { value: 'Inactive', label: 'Inactive' }], predicate: (row, vals) => vals.includes(row.is_active ? 'Active' : 'Inactive') },
    { key: 'uom', label: 'UOM', options: Array.from(new Set(items.map(i => i.uom))).map(u => ({ value: u, label: u })), predicate: (row, vals) => vals.includes(row.uom) }
  ], [items]);

  // 2. Ledgers Columns & Filters
  const ledgerColumns: DataTableColumn<any>[] = useMemo(() => [
    { key: 'date', header: 'Date', sortable: true, sortValue: r => new Date(r.created_at).getTime(), accessor: r => <span className="text-muted-foreground">{new Date(r.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</span> },
    { key: 'se', header: 'Executive', sortable: true, sortValue: r => r.profiles?.name || '', accessor: r => <span className="font-semibold">{r.profiles?.name || 'Unknown SE'}</span> },
    { key: 'item', header: 'Product', sortable: true, sortValue: r => r.item_master?.name || '', accessor: r => <span className="font-bold">{r.item_master?.name}</span> },
    { key: 'batch', header: 'Batch No.', sortable: true, sortValue: r => r.batch_number || '', accessor: r => <span className="font-mono text-xs">{r.batch_number || 'N/A'}</span> },
    { 
      key: 'type', header: 'Type', sortable: true, sortValue: r => r.txn_type, 
      accessor: r => (
        <Badge variant="outline" className={r.txn_type === 'IN' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-orange-50 text-orange-700 border-orange-200'}>
          {r.txn_type === 'IN' ? 'STOCK ASSIGNED' : 'STOCK SOLD (OUT)'}
        </Badge>
      ) 
    },
    { key: 'qty', header: 'Quantity', sortable: true, sortValue: r => r.qty, accessor: r => <span className="font-bold text-base">{r.txn_type === 'IN' ? '+' : '-'}{r.qty}</span> },
    { key: 'ref', header: 'Reference', sortable: true, sortValue: r => r.reference_id || '', accessor: r => <span className="font-mono text-xs">{r.reference_id}</span> }
  ], []);

  const ledgerFilters: DataTableFilter<any>[] = useMemo(() => [
    { key: 'type', label: 'Transaction Type', options: [{ value: 'IN', label: 'Stock Assigned (IN)' }, { value: 'OUT', label: 'Stock Sold (OUT)' }], predicate: (row, vals) => vals.includes(row.txn_type) },
    { key: 'se', label: 'Executive', options: executives.map(e => ({ value: e.name, label: e.name })), predicate: (row, vals) => vals.includes(row.profiles?.name) }
  ], [executives]);

  // 3. Orders Columns & Filters
  const orderColumns: DataTableColumn<any>[] = useMemo(() => [
    { 
      key: 'invoice', header: 'Invoice & Date', sortable: true, sortValue: r => new Date(r.created_at).getTime(), 
      accessor: r => (
        <>
          <span className="font-bold text-primary block">{r.invoice_no}</span>
          <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</span>
        </>
      ) 
    },
    { key: 'se', header: 'Sold By (SE)', sortable: true, sortValue: r => r.profiles?.name || '', accessor: r => <span className="font-medium">{r.profiles?.name || 'Unknown'}</span> },
    { 
      key: 'farmer', header: 'Farmer Details', sortable: true, sortValue: r => r.farmer_name || '', 
      accessor: r => (
        <>
          <span className="font-semibold block">{r.farmer_name}</span>
          <span className="text-xs text-muted-foreground">{r.farmer_mobile}</span>
        </>
      ) 
    },
    { key: 'amount', header: 'Amount (₹)', sortable: true, sortValue: r => r.total_amount, accessor: r => <span className="font-bold text-base">₹{r.total_amount}</span> },
    { 
      key: 'payment', header: 'Payment Mode', sortable: true, sortValue: r => r.payment_mode, 
      accessor: r => (
        <Badge variant="outline" className={r.payment_mode === 'UPI' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-amber-50 text-amber-700 border-amber-200'}>
          {r.payment_mode}
        </Badge>
      ) 
    },
    { 
      key: 'actions', header: 'Audit Actions', className: 'text-center', headerClassName: 'text-center',
      accessor: r => (
        <div className="flex items-center justify-center gap-2">
          {r.pdf_url && (
            <Button size="sm" variant="outline" onClick={() => window.open(r.pdf_url, '_blank')} className="h-7 text-xs">
              Invoice <ExternalLink className="h-3 w-3 ml-1" />
            </Button>
          )}
          {r.payment_mode === 'UPI' && r.payment_proof_url && (
            <Button size="sm" variant="default" onClick={() => window.open(r.payment_proof_url, '_blank')} className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700">
              UPI Proof <ExternalLink className="h-3 w-3 ml-1" />
            </Button>
          )}
        </div>
      ) 
    }
  ], []);

  const orderFilters: DataTableFilter<any>[] = useMemo(() => [
    { key: 'payment', label: 'Payment Mode', options: [{ value: 'CASH', label: 'CASH' }, { value: 'UPI', label: 'UPI' }], predicate: (row, vals) => vals.includes(row.payment_mode) },
    { key: 'se', label: 'Executive', options: executives.map(e => ({ value: e.name, label: e.name })), predicate: (row, vals) => vals.includes(row.profiles?.name) }
  ], [executives]);


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
            <DataTable 
              data={items} 
              columns={catalogColumns} 
              filters={catalogFilters}
              searchPlaceholder="Search product by name..."
              searchAccessor={r => r.name}
              rowKey={r => r.id}
              emptyMessage="No items in the catalog."
            />
          </TabsContent>

          {/* STOCK LEDGERS TAB */}
          <TabsContent value="ledgers" className="mt-0">
            <DataTable 
              data={ledgers} 
              columns={ledgerColumns} 
              filters={ledgerFilters}
              searchPlaceholder="Search by executive, product, or batch..."
              searchAccessor={r => `${r.profiles?.name || ''} ${r.item_master?.name || ''} ${r.batch_number || ''}`}
              rowKey={r => r.id}
              emptyMessage="No stock transactions found."
            />
          </TabsContent>

          {/* ORDERS & UPI AUDIT TAB */}
          <TabsContent value="orders" className="mt-0">
            <DataTable 
              data={orders} 
              columns={orderColumns} 
              filters={orderFilters}
              searchPlaceholder="Search by invoice, executive, or farmer name..."
              searchAccessor={r => `${r.invoice_no} ${r.profiles?.name || ''} ${r.farmer_name} ${r.farmer_mobile}`}
              rowKey={r => r.id}
              emptyMessage="No retail orders found."
            />
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

      {/* EDIT ITEM MODAL */}
      <Dialog open={isEditItemModalOpen} onOpenChange={(o) => { setIsEditItemModalOpen(o); if(!o) setEditingItem(null); }}>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Edit Catalog Item</DialogTitle>
          </DialogHeader>
          {editingItem && (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Product Name *</label>
                <Input value={editingItem.name} onChange={(e) => setEditingItem({...editingItem, name: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">MRP (₹) *</label>
                  <Input type="number" value={editingItem.mrp} onChange={(e) => setEditingItem({...editingItem, mrp: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Unit of Measure</label>
                  <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={editingItem.uom} onChange={(e) => setEditingItem({...editingItem, uom: e.target.value})}>
                    <option value="Bag">Bag</option>
                    <option value="Bottle">Bottle</option>
                    <option value="Pouch">Pouch</option>
                    <option value="Box">Box</option>
                    <option value="Kg">Kg</option>
                    <option value="Ltr">Ltr</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center justify-between bg-muted/30 p-3 rounded-lg border mt-2">
                <div className="space-y-0.5">
                  <label className="text-sm font-bold text-foreground">Active Status</label>
                  <p className="text-xs text-muted-foreground">Inactive items cannot be sold or assigned.</p>
                </div>
                <Switch checked={editingItem.is_active} onCheckedChange={(c) => setEditingItem({...editingItem, is_active: c})} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditItemModalOpen(false)}>Cancel</Button>
            <Button onClick={handleUpdateItem} disabled={isSubmitting}>{isSubmitting ? <Loader2 className="animate-spin h-4 w-4" /> : 'Update Item'}</Button>
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
                {/* Only show active items for transfer */}
                {items.filter(i => i.is_active).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
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