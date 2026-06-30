import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/AppLayout';
import { ExpenseActionSheet } from '@/components/ExpenseActionSheet';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { Loader2, Search, Shield, Receipt, Download, Calendar as CalendarIcon, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

const ExpensesPage = ({ onLogout }: { onLogout: () => void }) => {
  const { session, loading: authLoading } = useAuth();
  const userId = session?.user?.id;
  const { getModulePerm, loading: permLoading } = usePermissions(userId || '');
  const expenseAccess = getModulePerm('expenses');

  const [loading, setLoading] = useState(true);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [seList, setSeList] = useState<{id: string, name: string}[]>([]);
  const [selectedExpense, setSelectedExpense] = useState<any | null>(null);

  // 🚀 NEW: Advanced Filters
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [selectedSE, setSelectedSE] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 15;

  // 1. Fetch SE List (Only once on mount)
  useEffect(() => {
    if (!userId || !expenseAccess.can_view) return;
    supabase.from('profiles').select('id, name').eq('role', 'SE').order('name')
      .then(({ data }) => { if (data) setSeList(data); });
  }, [userId, expenseAccess.can_view]);

  // 2. Fetch Expenses whenever the selected month changes
  useEffect(() => {
    if (!userId || !expenseAccess.can_view) return;

    const fetchExpensesByMonth = async () => {
      setLoading(true);
      
      // Calculate start and end dates of the selected YYYY-MM
      const startDate = `${selectedMonth}-01T00:00:00.000Z`;
      
      // Move to the next month to get an exclusive end boundary
      const [year, month] = selectedMonth.split('-');
      const nextMonthDate = new Date(parseInt(year), parseInt(month), 1);
      const endDate = nextMonthDate.toISOString();

      const { data, error } = await supabase
        .from('expenses')
        // 🚀 UPDATED: Now joins the shifts table to grab odometer & GPS data!
        .select('*, profiles:se_id(name), shifts:shift_id(start_km, end_km, total_distance)') 
        .gte('date', startDate)
        .lt('date', endDate)
        .order('date', { ascending: false });

      if (data) setExpenses(data);
      setLoading(false);
    };

    fetchExpensesByMonth();
  }, [selectedMonth, userId, expenseAccess.can_view]);

  // Reset pagination when any filter changes
  useEffect(() => setCurrentPage(1), [selectedMonth, selectedSE, statusFilter]);

  // 🚀 Apply local filters (SE and Status)
  const filteredData = expenses.filter((exp) => {
    const matchesSE = selectedSE === 'All' || exp.se_id === selectedSE;
    const matchesStatus = statusFilter === 'All' || exp.status === statusFilter;
    return matchesSE && matchesStatus;
  });

  const totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE) || 1;
  const paginatedData = filteredData.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const handleExpenseUpdate = (id: string, newStatus: string) => {
    setExpenses(prev => prev.map(exp => exp.id === id ? { ...exp, status: newStatus } : exp));
    if (selectedExpense) setSelectedExpense({ ...selectedExpense, status: newStatus });
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

  // 🚀 NEW: Export to Excel / CSV
  const handleExport = () => {
    const headers = ['Date', 'Executive Name', 'Category', 'Amount (INR)', 'Status', 'Remarks'];
    const csvRows = [headers.join(',')];
    
    filteredData.forEach(exp => {
      const row = [
        `"${new Date(exp.date).toLocaleDateString()}"`,
        `"${exp.profiles?.name || 'Unknown'}"`,
        `"${exp.category}"`,
        exp.amount,
        `"${exp.status}"`,
        `"${(exp.remarks || '').replace(/"/g, '""')}"` // Escape quotes
      ];
      csvRows.push(row.join(','));
    });

    const blob = new Blob(['\uFEFF' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    
    // Dynamic file name based on filters
    const seName = selectedSE === 'All' ? 'All_SEs' : seList.find(s => s.id === selectedSE)?.name?.replace(/\s+/g, '_');
    link.download = `Expense_Report_${selectedMonth}_${seName}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
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
        {/* Header & Controls */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Receipt className="h-5 w-5 text-primary" /> Travel & Expenses
            </h2>
            <p className="text-sm text-muted-foreground">Manage and reimburse field executive expenses.</p>
          </div>

          <Button 
            variant="outline" 
            className="bg-green-50 text-green-700 hover:bg-green-100 border-green-200"
            onClick={handleExport}
            disabled={filteredData.length === 0}
          >
            <Download className="h-4 w-4 mr-2" /> Export Report
          </Button>
        </div>

        {/* 🚀 NEW: Dedicated Filter Bar */}
        <div className="bg-card border rounded-lg p-3 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            {/* Month Filter */}
            <div className="relative flex items-center w-full sm:w-auto">
              <CalendarIcon className="absolute left-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="pl-9 h-9 min-w-[150px]"
              />
            </div>
            
            {/* SE Dropdown Filter */}
            <div className="relative flex items-center w-full sm:w-auto">
              <User className="absolute left-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
              <select
                value={selectedSE}
                onChange={(e) => setSelectedSE(e.target.value)}
                className="flex h-9 w-full min-w-[200px] items-center justify-between rounded-md border border-input bg-transparent pl-9 pr-3 py-2 text-sm shadow-sm ring-offset-background focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="All">All Executives</option>
                {seList.map(se => (
                  <option key={se.id} value={se.id}>{se.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Status Tabs */}
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
            <div className="flex flex-col sm:flex-row items-center justify-between px-4 py-3 border-t bg-muted/20 gap-3">
              <div className="text-xs text-muted-foreground font-medium">
                Showing <span className="text-foreground">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> to <span className="text-foreground">{Math.min(currentPage * ITEMS_PER_PAGE, filteredData.length)}</span> of <span className="text-foreground">{filteredData.length}</span> entries
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="h-8 px-3 text-xs" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>Prev</Button>
                <div className="text-xs font-semibold px-2">Page {currentPage} of {totalPages}</div>
                <Button variant="outline" size="sm" className="h-8 px-3 text-xs" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Next</Button>
              </div>
            </div>
          )}
        </div>
      </div>

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