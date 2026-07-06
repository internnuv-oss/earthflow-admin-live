import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/AppLayout';
import { ExpenseActionSheet } from '@/components/ExpenseActionSheet';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { Loader2, Shield, Receipt, Download, Calendar as CalendarIcon, User, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

const ExpensesPage = ({ onLogout }: { onLogout: () => void }) => {
  const { session, loading: authLoading } = useAuth();
  const userId = session?.user?.id;
  const { getModulePerm, loading: permLoading } = usePermissions(userId || '');
  const expenseAccess = getModulePerm('expenses');
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [seList, setSeList] = useState<{id: string, name: string}[]>([]);
  const [selectedExpense, setSelectedExpense] = useState<any | null>(null);

  // 🚀 ON-SCREEN FILTERS
  const [selectedDate, setSelectedDate] = useState(''); // Specific date search
  const [selectedSE, setSelectedSE] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [categoryFilter, setCategoryFilter] = useState('All'); 
  // 🚀 ON-SCREEN FILTERS
  
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }); // 🚀 NEW: Month filter, defaulting to current month!
  
  // 🚀 EXPORT MODAL STATES
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [exportMonth, setExportMonth] = useState(() => {
    const now = new Date();
    // 🚀 Default the export modal to the CURRENT month
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [exportSE, setExportSE] = useState('All');
  const [exportCategory, setExportCategory] = useState('All'); // New Category export filter
  const [exportLoading, setExportLoading] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 15;

  // 1. Fetch SE List
  // 1. Fetch SE List (Safely grab false AND null values)
  useEffect(() => {
    if (!userId || !expenseAccess.can_view) return;
    
    supabase
      .from('profiles')
      .select('id, name')
      .eq('role', 'SE')
      .or('is_demo.eq.false,is_demo.is.null') // 🚀 FIXED: Safely excludes true, but keeps real users!
      .order('name')
      .then(({ data }) => { 
        if (data) setSeList(data); 
      });
  }, [userId, expenseAccess.can_view]);

  // 2. Fetch Base Expenses
  useEffect(() => {
    if (!userId || !expenseAccess.can_view) return;

    const fetchExpenses = async () => {
      setLoading(true);
      
      let startDateStr, endDateStr;

      if (selectedDate) {
        // If user picked a specific date, fetch exactly that day
        startDateStr = `${selectedDate}T00:00:00.000Z`;
        endDateStr = `${selectedDate}T23:59:59.999Z`;
      } else {
        // 🚀 NEW: Use the selectedMonth filter! (Fallback to current month if they somehow clear it)
        const activeMonth = selectedMonth || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
        const [year, month] = activeMonth.split('-');
        
        startDateStr = `${year}-${month}-01T00:00:00.000Z`;
        
        const nextMonth = new Date(parseInt(year), parseInt(month), 1);
        endDateStr = nextMonth.toISOString();
      }

      // Fetch all records for the time window
      const query = supabase
        .from('expenses')
        .select('*, profiles:se_id(name), shifts:shift_id(start_time, end_time, start_km, end_km, total_distance, start_odo_image, end_odo_image)') 
        .gte('date', startDateStr)
        .lt('date', endDateStr) 
        .order('date', { ascending: false });

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching expenses:", error);
      } else if (data) {
        setExpenses(data);
      }
      
      setLoading(false);
    };

    fetchExpenses();
  }, [selectedDate, selectedMonth, userId, expenseAccess.can_view]); // 🚀 Added selectedMonth here

  // Reset pagination on filter change
  useEffect(() => setCurrentPage(1), [selectedDate, selectedMonth, selectedSE, statusFilter, categoryFilter]); // 🚀 Added selectedMonth here



  // 3. Client-Side Instant Filters
  // 3. Client-Side Instant Filters
  const filteredData = expenses.filter((exp) => {
    // 🚀 NEW: Ensure the expense belongs to a real executive from our list!
    // (We check length > 0 so the table doesn't flash empty while loading)
    const isRealSE = seList.length === 0 || seList.some(se => se.id === exp.se_id);
    if (!isRealSE) return false;

    const matchesSE = selectedSE === 'All' || exp.se_id === selectedSE;
    const matchesStatus = statusFilter === 'All' || exp.status === statusFilter;
    const matchesCategory = categoryFilter === 'All' || 
      (exp.category || '').trim().toLowerCase() === categoryFilter.toLowerCase();
    
    return matchesSE && matchesStatus && matchesCategory;
  });
  

  const totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE) || 1;
  const paginatedData = filteredData.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const handleExpenseUpdate = (id: string, newStatus: string, newAmount?: number) => {
    setExpenses(prev => prev.map(exp => 
      exp.id === id 
        ? { ...exp, status: newStatus, amount: newAmount !== undefined ? newAmount : exp.amount } 
        : exp
    ));
    if (selectedExpense) {
      setSelectedExpense({ 
        ...selectedExpense, 
        status: newStatus, 
        amount: newAmount !== undefined ? newAmount : selectedExpense.amount 
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: any = {
      'Pending': 'bg-amber-100 text-amber-800 border-amber-200',
      'Approved': 'bg-green-100 text-green-800 border-green-200',
      'Rejected': 'bg-red-100 text-red-800 border-red-200',
      'Queried': 'bg-blue-100 text-blue-800 border-blue-200',
    };
    return <Badge variant="outline" className={styles[status] || 'bg-muted'}>{status}</Badge>;
  };

  // 🚀 ADVANCED CSV EXPORT (By Month, SE, and Category)
  const executeExport = async () => {
    setExportLoading(true);

    const [year, month] = exportMonth.split('-');
    const startDate = `${exportMonth}-01T00:00:00.000Z`;
    const nextMonth = new Date(parseInt(year), parseInt(month), 1);
    const endDate = nextMonth.toISOString();

    let query = supabase
      .from('expenses')
      .select('*, profiles:se_id(name)')
      .gte('date', startDate)
      .lt('date', endDate)
      .order('date', { ascending: true });

    if (exportSE !== 'All') {
      query = query.eq('se_id', exportSE);
    }
    
    if (exportCategory !== 'All') {
      query = query.eq('category', exportCategory);
    }

    const { data, error } = await query;
    setExportLoading(false);

    if (error || !data) {
      return toast({ title: 'Export Failed', description: error?.message, variant: 'destructive' });
    }

    // Filter out deleted/demo users from the export
    const cleanData = data.filter(exp => seList.some(se => se.id === exp.se_id));

    if (cleanData.length === 0) {
      return toast({ title: 'No Data', description: 'No expenses found for these exact filters.' });
    }

    const headers = ['Date', 'Executive Name', 'Category', 'Amount (INR)', 'Status', 'Remarks'];
    const csvRows = [headers.join(',')];
    
    cleanData.forEach(exp => {
      const row = [
        `"${new Date(exp.date).toLocaleDateString()}"`,
        `"${exp.profiles?.name || 'Unknown'}"`,
        `"${exp.category}"`,
        exp.amount,
        `"${exp.status}"`,
        `"${(exp.remarks || '').replace(/"/g, '""')}"` 
      ];
      csvRows.push(row.join(','));
    });

    const blob = new Blob(['\uFEFF' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    
    const seName = exportSE === 'All' ? 'All_SEs' : seList.find(s => s.id === exportSE)?.name?.replace(/\s+/g, '_');
    const catName = exportCategory === 'All' ? 'All_Cats' : exportCategory.replace(/[^a-zA-Z0-9]/g, '');
    
    link.download = `Expenses_${exportMonth}_${seName}_${catName}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
    setIsExportOpen(false);
  };

  if (authLoading || permLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;

  if (!expenseAccess.can_view) {
    return (
      <AppLayout onLogout={onLogout}>
        <div className="flex flex-col items-center justify-center h-[60vh] text-center">
          <Shield className="h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold">Access Denied</h2>
          <p className="text-muted-foreground">You do not have permission to view expenses.</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout onLogout={onLogout}>
      <div className="space-y-6">
        
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Receipt className="h-5 w-5 text-primary" /> Travel & Expenses
            </h2>
            <p className="text-sm text-muted-foreground">
              {selectedDate 
                ? `Showing records for ${new Date(selectedDate).toLocaleDateString()}` 
                : `Showing records for ${new Date(selectedMonth + '-01').toLocaleDateString([], { month: 'long', year: 'numeric' })}`}
            </p>
          </div>

          <Button 
            variant="outline" 
            className="bg-green-50 text-green-700 hover:bg-green-100 border-green-200"
            onClick={() => setIsExportOpen(true)}
          >
            <Download className="h-4 w-4 mr-2" /> Export CSV
          </Button>
        </div>

        {/* Filters Bar */}
        <div className="bg-card border rounded-lg p-3 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto flex-wrap">
            
            <div className="relative flex items-center w-full sm:w-auto">
              <CalendarIcon className="absolute left-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="pl-9 h-9 min-w-[150px]"
                title="Search by specific date (Overrides default month)"
              />
            </div>

            <div className="relative flex items-center w-full sm:w-auto">
              <CalendarIcon className="absolute left-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                type="month"
                value={selectedMonth}
                onChange={(e) => {
                  setSelectedMonth(e.target.value);
                  setSelectedDate(''); // 🚀 Clear specific date if they pick a whole month
                }}
                className="pl-9 h-9 min-w-[150px]"
                title="Search by month"
              />
            </div>
            
            <div className="relative flex items-center w-full sm:w-auto">
              <User className="absolute left-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
              <select
                value={selectedSE}
                onChange={(e) => setSelectedSE(e.target.value)}
                className="flex h-9 w-full min-w-[180px] items-center justify-between rounded-md border border-input bg-transparent pl-9 pr-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="All">All Executives</option>
                {seList.map(se => (
                  <option key={se.id} value={se.id}>{se.name}</option>
                ))}
              </select>
            </div>

            <div className="relative flex items-center w-full sm:w-auto">
              <Tag className="absolute left-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="flex h-9 w-full min-w-[150px] items-center justify-between rounded-md border border-input bg-transparent pl-9 pr-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="All">All Categories</option>
                <option value="TA/DA">TA/DA</option>
                <option value="Travelling">Travelling</option>
                <option value="Food">Food</option>
                <option value="Misc">Misc</option>
              </select>
            </div>
          </div>

          <div className="w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
            <Tabs value={statusFilter} onValueChange={setStatusFilter} className="w-full">
              <TabsList className="h-9 w-full sm:w-auto justify-start">
                <TabsTrigger value="All" className="text-xs">All</TabsTrigger>
                <TabsTrigger value="Pending" className="text-xs">Pending</TabsTrigger>
                <TabsTrigger value="Approved" className="text-xs">Approved</TabsTrigger>
                <TabsTrigger value="Queried" className="text-xs">Queried</TabsTrigger>
                <TabsTrigger value="Rejected" className="text-xs">Rejected</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        {/* Data Table */}
        <div className="bg-card border rounded-lg shadow-sm flex flex-col overflow-hidden">
          <div className="overflow-x-auto">
            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : (
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="px-4 py-3 font-semibold text-muted-foreground">Date</th>
                    <th className="px-4 py-3 font-semibold text-muted-foreground">Executive</th>
                    <th className="px-4 py-3 font-semibold text-muted-foreground">Category</th>
                    <th className="px-4 py-3 font-semibold text-muted-foreground">Amount</th>
                    <th className="px-4 py-3 font-semibold text-muted-foreground">Status</th>
                    <th className="px-4 py-3 font-semibold text-muted-foreground text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {paginatedData.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-muted-foreground">
                        <Receipt className="h-8 w-8 mx-auto mb-3 opacity-20" />
                        No expenses found for this criteria.
                      </td>
                    </tr>
                  ) : (
                    paginatedData.map((exp) => (
                      <tr key={exp.id} className="hover:bg-muted/20 cursor-pointer transition-colors" onClick={() => setSelectedExpense(exp)}>
                        <td className="px-4 py-3 whitespace-nowrap">{new Date(exp.date).toLocaleDateString()}</td>
                        <td className="px-4 py-3 font-medium">{exp.profiles?.name || '—'}</td>
                        <td className="px-4 py-3">{exp.category}</td>
                        <td className="px-4 py-3 font-bold">₹{Number(exp.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        <td className="px-4 py-3">{getStatusBadge(exp.status)}</td>
                        <td className="px-4 py-3 text-right">
                          <Button variant="ghost" size="sm" className="h-8 text-xs font-semibold text-primary">
                            Review
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination Footer */}
          {!loading && filteredData.length > 0 && (
            <div className="flex flex-col md:flex-row items-center justify-between px-4 py-3 border-t bg-muted/20 gap-4">
              
              <div className="text-xs text-muted-foreground font-medium w-full md:w-auto text-center md:text-left">
                Showing <span className="text-foreground">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> to <span className="text-foreground">{Math.min(currentPage * ITEMS_PER_PAGE, filteredData.length)}</span> of <span className="text-foreground">{filteredData.length}</span> entries
              </div>

              <div className="flex items-center gap-2 bg-primary/10 text-primary px-4 py-1.5 rounded-md border border-primary/20 shadow-sm">
                <span className="text-xs font-bold uppercase tracking-wider">Filtered Total:</span>
                <span className="text-sm font-extrabold">
                  ₹{filteredData.reduce((sum, exp) => sum + Number(exp.amount || 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="flex items-center gap-2 w-full md:w-auto justify-center md:justify-end">
                <Button variant="outline" size="sm" className="h-8 px-3 text-xs" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>Prev</Button>
                <div className="text-xs font-semibold px-2">Page {currentPage} of {totalPages}</div>
                <Button variant="outline" size="sm" className="h-8 px-3 text-xs" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Next</Button>
              </div>
              
            </div>
          )}
        </div>
      </div>

      {/* Export CSV Modal */}
      <Dialog open={isExportOpen} onOpenChange={setIsExportOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Export Expenses to CSV</DialogTitle>
            <DialogDescription>
              Filter the exact records you want to download.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold">Select Month *</label>
              <Input 
                type="month" 
                value={exportMonth} 
                onChange={e => setExportMonth(e.target.value)} 
                required 
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold">Select Executive *</label>
              <select
                value={exportSE}
                onChange={(e) => setExportSE(e.target.value)}
                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                <option value="All">All Executives</option>
                {seList.map(se => (
                  <option key={se.id} value={se.id}>{se.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold">Select Category *</label>
              <select
                value={exportCategory}
                onChange={(e) => setExportCategory(e.target.value)}
                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                <option value="All">All Categories</option>
                <option value="TA/DA">TA/DA</option>
                <option value="Travelling">Travelling</option>
                <option value="Food">Food</option>
                <option value="Misc">Misc</option>
              </select>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsExportOpen(false)}>Cancel</Button>
            <Button onClick={executeExport} disabled={exportLoading}>
              {exportLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
              Download Report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ExpenseActionSheet 
        open={!!selectedExpense} 
        expense={selectedExpense} 
        onClose={() => setSelectedExpense(null)} 
        onUpdate={handleExpenseUpdate}
        canEdit={expenseAccess.can_edit}
      />
    </AppLayout>
  );
};

export default ExpensesPage;