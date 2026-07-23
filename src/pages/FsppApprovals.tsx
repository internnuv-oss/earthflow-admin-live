import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import AppLayout from '@/components/AppLayout';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { Shield } from 'lucide-react';
import { Loader2, CheckCircle, XCircle, Clock, ShieldCheck, Eye, Calendar as CalendarIcon, Search, Filter, RotateCcw } from 'lucide-react';

// 🚀 NEW IMPORTS FOR THE DATE RANGE PICKER
import { format } from "date-fns";
import { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import FarmerDetailSheet from '@/components/FarmerDetailSheet'; 

export default function FsppApprovals({ onLogout }: { onLogout: () => void }) {
  const { toast } = useToast();

  // 🚀 NEW: Auth & Permissions Hooks
  const { session, loading: authLoading } = useAuth();
  const { getModulePerm, loading: permLoading } = usePermissions(session?.user?.id);
  const access = getModulePerm('fspp_approvals');

  const [loading, setLoading] = useState(true);
  const [farmCards, setFarmCards] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('PENDING');
  
  // 🚀 NEW: Unified DateRange State (Defaults to current month)
  const [date, setDate] = useState<DateRange | undefined>(() => {
    const d = new Date();
    return {
      from: new Date(d.getFullYear(), d.getMonth(), 1),
      to: new Date(d.getFullYear(), d.getMonth() + 1, 0)
    };
  });

  // Search and Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [seFilter, setSeFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [minLandFilter, setMinLandFilter] = useState('');
  const [landUnitFilter, setLandUnitFilter] = useState('Acres');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // Dialog State
  const [selectedCard, setSelectedCard] = useState<any | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const db = supabase as any;

  // Fetch when the date range changes
  useEffect(() => {
    fetchFarmCards();
  }, [date]);

  // Reset pagination if ANY filter or tab changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, date, searchQuery, seFilter, categoryFilter, minLandFilter, landUnitFilter]);

  const fetchFarmCards = async () => {
    // If they cleared the calendar entirely, don't fetch
    if (!date?.from) return; 
    setLoading(true);
    
    // 🚀 SMART DATE LOGIC:
    // If they only clicked ONE day, we use that same day for both start and end!
    const fromDate = new Date(date.from);
    fromDate.setHours(0, 0, 0, 0); // Start of day
    const startISO = fromDate.toISOString();

    const toDate = date.to ? new Date(date.to) : new Date(date.from);
    toDate.setHours(23, 59, 59, 999); // End of day
    const endISO = toDate.toISOString();

    const { data, error } = await db
      .from('farm_cards')
      .select(`
        id, status, fspp_approval_status, created_at, card_data,
        farmers ( * ), 
        profiles:se_id ( name )
      `)
      .gte('created_at', startISO) 
      .lte('created_at', endISO)    
      .order('created_at', { ascending: false });

    if (error) {
      toast({ title: 'Error fetching farm cards', description: error.message, variant: 'destructive' });
    } else if (data) {
      const formattedData = data.map((fc: any) => ({
        ...fc,
        fspp_approval_status: fc.fspp_approval_status || 'PENDING'
      }));
      setFarmCards(formattedData);
    }
    setLoading(false);
  };

  const handleUpdateStatus = async (cardId: string, newStatus: 'APPROVED' | 'REJECTED') => {
    const { error } = await db
      .from('farm_cards')
      .update({ fspp_approval_status: newStatus })
      .eq('id', cardId);

    if (error) {
      toast({ title: 'Update Failed', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: `Card ${newStatus}`, description: `Farm card has been ${newStatus.toLowerCase()}.` });
      setFarmCards(prev => prev.map(c => c.id === cardId ? { ...c, fspp_approval_status: newStatus } : c));
      setIsDetailsOpen(false); 
    }
  };

  // Reset Filters Function
  const handleResetFilters = () => {
    setSearchQuery('');
    setSeFilter('ALL');
    setCategoryFilter('ALL');
    setMinLandFilter('');
    setLandUnitFilter('Acres');
    
    // Reset date back to current month
    const d = new Date();
    setDate({
      from: new Date(d.getFullYear(), d.getMonth(), 1),
      to: new Date(d.getFullYear(), d.getMonth() + 1, 0)
    });
  };

  const uniqueSEs = Array.from(new Set(farmCards.map(c => c.profiles?.name).filter(Boolean)));

  const baseFilteredCards = farmCards.filter(c => {
    const farmerName = (c.farmers?.full_name || '').toLowerCase();
    const mobile = c.farmers?.mobile || '';
    const seName = c.profiles?.name || '';
    const cat = c.farmers?.fspp_details?.category || 'Uncategorized';
    const committedLand = parseFloat(c.farmers?.fspp_details?.committedLand || 0);
    const farmerLandUnit = c.farmers?.fspp_details?.committedLandUnit || 'Acres';

    const matchesSearch = !searchQuery || farmerName.includes(searchQuery.toLowerCase()) || mobile.includes(searchQuery);
    const matchesSE = seFilter === 'ALL' || seName === seFilter;
    const matchesCat = categoryFilter === 'ALL' || cat === categoryFilter;
    const matchesLand = !minLandFilter || (farmerLandUnit === landUnitFilter && committedLand >= parseFloat(minLandFilter));

    return matchesSearch && matchesSE && matchesCat && matchesLand;
  });

  // 🚀 NEW: Layer 2 RBAC Guard (Add this right before `const totalPages = ...`)
  if (authLoading || permLoading) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!access.can_view) {
    return (
      <AppLayout onLogout={onLogout}>
        <div className="flex flex-col items-center justify-center h-[60vh] text-center">
          <Shield className="h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold">Access Denied</h2>
          <p className="text-muted-foreground">You do not have permission to view FSPP Approvals.</p>
        </div>
      </AppLayout>
    );
  }

  const tabFilteredCards = baseFilteredCards.filter(c => c.fspp_approval_status === activeTab);
  const totalPages = Math.ceil(tabFilteredCards.length / ITEMS_PER_PAGE) || 1;
  const paginatedCards = tabFilteredCards.slice(
    (currentPage - 1) * ITEMS_PER_PAGE, 
    currentPage * ITEMS_PER_PAGE
  );

  const pendingCount = baseFilteredCards.filter(c => c.fspp_approval_status === 'PENDING').length;
  const approvedCount = baseFilteredCards.filter(c => c.fspp_approval_status === 'APPROVED').length;
  const rejectedCount = baseFilteredCards.filter(c => c.fspp_approval_status === 'REJECTED').length;

  return (
    <AppLayout onLogout={onLogout}>
      <div className="flex flex-col gap-6 animate-in fade-in duration-300">
        
        {/* Header & New Single Calendar Filter */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">FSPP Farm Card Approvals</h2>
            <p className="text-muted-foreground">Review and approve Farm Cards based on the farmer's FSPP Category.</p>
          </div>
          
          {/* 🚀 THE NEW DATE RANGE PICKER COMPONENT */}
          <div className="flex items-center gap-2">
            <Label className="text-sm font-semibold text-muted-foreground mr-1 hidden sm:block">Filter Date:</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id="date"
                  variant={"outline"}
                  className={cn(
                    "w-[260px] justify-start text-left font-normal bg-white shadow-sm",
                    !date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date?.from ? (
                    date.to ? (
                      <>
                        {format(date.from, "LLL dd, y")} - {format(date.to, "LLL dd, y")}
                      </>
                    ) : (
                      format(date.from, "LLL dd, y")
                    )
                  ) : (
                    <span>Pick a date range</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={date?.from}
                  selected={date}
                  onSelect={setDate}
                  numberOfMonths={1}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Smart Filter Bar */}
        <div className="bg-white p-4 rounded-lg border shadow-sm grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
          
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1.5"><Search className="h-3 w-3"/> Search Farmer</Label>
            <Input 
              placeholder="Name or Mobile..." 
              value={searchQuery} 
              onChange={(e) => setSearchQuery(e.target.value)} 
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1.5"><Filter className="h-3 w-3"/> SE Name</Label>
            <Select value={seFilter} onValueChange={setSeFilter}>
              <SelectTrigger><SelectValue placeholder="All Executives" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Executives</SelectItem>
                {uniqueSEs.map((se: any) => (
                  <SelectItem key={se} value={se}>{se}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1.5"><Filter className="h-3 w-3"/> FSPP Category</Label>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger><SelectValue placeholder="All Categories" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Categories</SelectItem>
                <SelectItem value="Category A">Category A</SelectItem>
                <SelectItem value="Category B">Category B</SelectItem>
                <SelectItem value="Category C">Category C</SelectItem>
                <SelectItem value="Category D">Category D</SelectItem>
                <SelectItem value="Uncategorized">Uncategorized</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1.5"><Filter className="h-3 w-3"/> Min. Committed Land</Label>
            <div className="flex gap-2">
              <Input 
                type="number"
                min="0"
                placeholder="e.g. 5" 
                value={minLandFilter} 
                onChange={(e) => setMinLandFilter(e.target.value)} 
                className="w-full"
              />
              <Select value={landUnitFilter} onValueChange={setLandUnitFilter}>
                <SelectTrigger className="w-[100px] shrink-0"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Acres">Acres</SelectItem>
                  <SelectItem value="Bigha">Bigha</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end lg:justify-start">
            <Button 
              variant="outline" 
              className="w-full lg:w-auto gap-2 text-muted-foreground hover:text-foreground"
              onClick={handleResetFilters}
            >
              <RotateCcw className="h-4 w-4" /> Reset Filters
            </Button>
          </div>

        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-3 mb-4 h-12">
            <TabsTrigger value="PENDING" className="gap-2">
              <Clock className="h-4 w-4"/> Pending 
              {pendingCount > 0 && <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center rounded-full bg-amber-100 text-amber-700">{pendingCount}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="APPROVED" className="gap-2"><CheckCircle className="h-4 w-4"/> Approved ({approvedCount})</TabsTrigger>
            <TabsTrigger value="REJECTED" className="gap-2"><XCircle className="h-4 w-4"/> Rejected ({rejectedCount})</TabsTrigger>
          </TabsList>

          <Card className="border-primary/20 shadow-sm flex flex-col">
            <CardHeader className="bg-muted/30 border-b pb-4">
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" /> 
                {activeTab === 'PENDING' ? 'Awaiting Admin Approval' : `${activeTab} Farm Cards`}
              </CardTitle>
              <CardDescription>
                {date?.from && date?.to 
                  ? `Showing data from ${format(date.from, "MMM d, yyyy")} to ${format(date.to, "MMM d, yyyy")}. Category A farmers are Auto-Approved.`
                  : date?.from 
                  ? `Showing data for ${format(date.from, "MMM d, yyyy")}. Category A farmers are Auto-Approved.`
                  : 'Please select a date range.'
                }
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              {loading ? (
                <div className="flex justify-center items-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead className="pl-6">Date</TableHead>
                      <TableHead>Farmer Details</TableHead>
                      <TableHead>FSPP Category & Score</TableHead>
                      <TableHead>Committed Land</TableHead>
                      <TableHead>SE Name</TableHead>
                      <TableHead className="text-right pr-6">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedCards.length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-12">No {activeTab.toLowerCase()} farm cards found matching your filters.</TableCell></TableRow>
                    ) : (
                      paginatedCards.map((card) => {
                        const farmer = card.farmers || {};
                        const fspp = farmer.fspp_details || {};
                        const isCatA = fspp.category === 'Category A';

                        return (
                          <TableRow key={card.id}>
                            <TableCell className="pl-6 text-sm text-muted-foreground">
                              {new Date(card.created_at).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              <div className="font-semibold text-foreground">{farmer.full_name || 'Unknown'}</div>
                              <div className="text-xs text-muted-foreground">{farmer.village || 'N/A'} • {farmer.mobile || 'N/A'}</div>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-1 items-start">
                                <Badge className={
                                  isCatA ? 'bg-green-100 text-green-800 hover:bg-green-200 border-green-300' :
                                  fspp.category?.includes('B') ? 'bg-blue-100 text-blue-800 hover:bg-blue-200 border-blue-300' :
                                  fspp.category?.includes('C') ? 'bg-amber-100 text-amber-800 hover:bg-amber-200 border-amber-300' :
                                  'bg-slate-100 text-slate-800 hover:bg-slate-200 border-slate-300'
                                }>
                                  {fspp.category || 'Uncategorized'}
                                </Badge>
                                <span className="text-[11px] font-medium text-muted-foreground ml-1">Score: {fspp.score || 0}/100</span>
                              </div>
                            </TableCell>
                            <TableCell className="font-medium">
                              {fspp.committedLand ? `${fspp.committedLand} ${fspp.committedLandUnit || 'Acres'}` : '--'}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {card.profiles?.name || 'Unknown SE'}
                            </TableCell>
                            <TableCell className="text-right pr-6">
                              <div className="flex justify-end gap-2">
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  title="View Farmer Full Profile"
                                  onClick={() => { setSelectedCard(card); setIsDetailsOpen(true); }}
                                >
                                  <Eye className="h-4 w-4 text-muted-foreground" />
                                </Button>
                                
                                {activeTab === 'PENDING' && access.can_edit && (
                                  <>
                                    <Button
                                      size="sm"
                                      className="bg-green-600 hover:bg-green-700 text-white h-8"
                                      onClick={() => handleUpdateStatus(card.id, 'APPROVED')}
                                    >
                                      Approve
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200 h-8"
                                      onClick={() => handleUpdateStatus(card.id, 'REJECTED')}
                                    >
                                      Reject
                                    </Button>
                                  </>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>

            {!loading && tabFilteredCards.length > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between px-6 py-3 border-t bg-muted/10 gap-3 rounded-b-lg">
                <div className="text-xs text-muted-foreground font-medium">
                  Showing <span className="text-foreground">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> to <span className="text-foreground">{Math.min(currentPage * ITEMS_PER_PAGE, tabFilteredCards.length)}</span> of <span className="text-foreground">{tabFilteredCards.length}</span> entries
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="h-8 px-3 text-xs" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>Previous</Button>
                  <div className="text-xs font-semibold px-2">Page {currentPage} of {totalPages}</div>
                  <Button variant="outline" size="sm" className="h-8 px-3 text-xs" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Next</Button>
                </div>
              </div>
            )}
          </Card>
        </Tabs>
      </div>

      {selectedCard && (
        <FarmerDetailSheet 
          farmer={selectedCard.farmers}  
          open={isDetailsOpen} 
          canEdit={false}
          onClose={() => {
            setIsDetailsOpen(false);
            setTimeout(() => setSelectedCard(null), 300); 
          }} 
        />
      )}
    </AppLayout>
  );
}