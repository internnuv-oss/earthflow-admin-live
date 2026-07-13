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
import { Loader2, CheckCircle, XCircle, Clock, ShieldCheck, Eye, Calendar } from 'lucide-react';

// 🚀 IMPORTS THE SHEET COMPONENT
import FarmerDetailSheet from '@/components/FarmerDetailSheet'; 

export default function FsppApprovals({ onLogout }: { onLogout: () => void }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [farmCards, setFarmCards] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('PENDING');
  
  // Month Filter State
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // Dialog State
  const [selectedCard, setSelectedCard] = useState<any | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const db = supabase as any;

  useEffect(() => {
    fetchFarmCards();
  }, [selectedMonth]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, selectedMonth]);

  const fetchFarmCards = async () => {
    setLoading(true);
    
    const [year, month] = selectedMonth.split('-');
    const startDate = `${selectedMonth}-01T00:00:00.000Z`;
    const nextMonthDate = new Date(parseInt(year), parseInt(month), 1);
    const endDate = nextMonthDate.toISOString();

    const { data, error } = await db
      .from('farm_cards')
      .select(`
        id, status, fspp_approval_status, created_at, card_data,
        farmers ( * ), 
        profiles:se_id ( name )
      `)
      // 🚀 CHANGED TO `farmers ( * )` above so the Sheet gets all the Personal/Farm details!
      .gte('created_at', startDate) 
      .lt('created_at', endDate)    
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
      
      // If the admin approved it while looking at the Quick Actions in the table, close the sheet if it's open
      setIsDetailsOpen(false); 
    }
  };

  const filteredCards = farmCards.filter(c => c.fspp_approval_status === activeTab);
  const totalPages = Math.ceil(filteredCards.length / ITEMS_PER_PAGE) || 1;
  const paginatedCards = filteredCards.slice(
    (currentPage - 1) * ITEMS_PER_PAGE, 
    currentPage * ITEMS_PER_PAGE
  );

  const pendingCount = farmCards.filter(c => c.fspp_approval_status === 'PENDING').length;
  const approvedCount = farmCards.filter(c => c.fspp_approval_status === 'APPROVED').length;
  const rejectedCount = farmCards.filter(c => c.fspp_approval_status === 'REJECTED').length;

  return (
    <AppLayout onLogout={onLogout}>
      <div className="flex flex-col gap-6 animate-in fade-in duration-300">
        
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">FSPP Farm Card Approvals</h2>
            <p className="text-muted-foreground">Review and approve Farm Cards based on the farmer's FSPP Category.</p>
          </div>
          <div className="flex items-center gap-2 bg-white border p-2 rounded-lg shadow-sm">
            <Calendar className="h-4 w-4 text-muted-foreground ml-1" />
            <Label className="text-sm font-semibold text-muted-foreground mr-1">Filter Month:</Label>
            <Input 
              type="month" 
              value={selectedMonth} 
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="h-8 w-40" 
            />
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
                Showing data for {new Date(selectedMonth + '-01').toLocaleDateString([], { month: 'long', year: 'numeric' })}. Category A farmers are Auto-Approved.
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
                      <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-12">No {activeTab.toLowerCase()} farm cards found.</TableCell></TableRow>
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
                                {/* 🚀 OPENS YOUR FARMER DETAIL SHEET */}
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  title="View Farmer Full Profile"
                                  onClick={() => { setSelectedCard(card); setIsDetailsOpen(true); }}
                                >
                                  <Eye className="h-4 w-4 text-muted-foreground" />
                                </Button>
                                
                                {activeTab === 'PENDING' && (
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

            {!loading && filteredCards.length > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between px-6 py-3 border-t bg-muted/10 gap-3 rounded-b-lg">
                <div className="text-xs text-muted-foreground font-medium">
                  Showing <span className="text-foreground">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> to <span className="text-foreground">{Math.min(currentPage * ITEMS_PER_PAGE, filteredCards.length)}</span> of <span className="text-foreground">{filteredCards.length}</span> entries
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

      {/* 🚀 THE FARMER DETAIL SHEET INTEGRATION */}
      {selectedCard && (
        <FarmerDetailSheet 
          farmer={selectedCard.farmers}  // Passing the full farmer object we grabbed from the DB!
          open={isDetailsOpen} 
          canEdit={false} // Disable editing from this view just to be safe
          onClose={() => {
            setIsDetailsOpen(false);
            setTimeout(() => setSelectedCard(null), 300); // Small delay for smooth closing animation
          }} 
        />
      )}
    </AppLayout>
  );
}