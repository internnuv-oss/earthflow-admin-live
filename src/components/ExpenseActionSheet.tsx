import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Receipt, Calendar, User, FileText, CheckCircle, XCircle, HelpCircle, Navigation, Map } from 'lucide-react';

interface Props {
  expense: any | null;
  open: boolean;
  onClose: () => void;
  onUpdate: (id: string, newStatus: string) => void;
  canEdit: boolean;
}

export const ExpenseActionSheet = ({ expense, open, onClose, onUpdate, canEdit }: Props) => {
  const { toast } = useToast();
  const [updating, setUpdating] = useState(false);

  if (!expense) return null;

  const handleUpdateStatus = async (newStatus: string) => {
    setUpdating(true);
    try {
      const { error } = await supabase
        .from('expenses')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', expense.id);

      if (error) throw error;
      
      toast({ title: `Expense ${newStatus}`, description: `The expense has been marked as ${newStatus}.` });
      onUpdate(expense.id, newStatus);
      onClose();
    } catch (error: any) {
      toast({ title: 'Update Failed', description: error.message, variant: 'destructive' });
    } finally {
      setUpdating(false);
    }
  };

  const statusColors: any = {
    'Pending': 'bg-amber-100 text-amber-800 border-amber-200',
    'Approved': 'bg-green-100 text-green-800 border-green-200',
    'Rejected': 'bg-red-100 text-red-800 border-red-200',
    'Queried': 'bg-blue-100 text-blue-800 border-blue-200',
  };

  // 🚀 LOGIC: Check if it's a travel expense and safely parse the distances
  const isTravel = expense.category?.toLowerCase().includes('travel');
  const shift = expense.shifts; // The joined data from our updated page query
  let manualKm = 0;
  let gpsKm = 0;

  if (isTravel && shift) {
    const start = parseFloat(shift.start_km) || 0;
    const end = parseFloat(shift.end_km) || 0;
    manualKm = end > start ? (end - start) : 0;
    gpsKm = shift.total_distance || 0;
  }

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-0">
        <SheetHeader className="px-6 py-5 border-b bg-muted/30">
          <div className="flex items-start justify-between">
            <div>
              <SheetTitle className="text-xl">Expense Details</SheetTitle>
              <SheetDescription>Review and process this claim.</SheetDescription>
            </div>
            <Badge variant="outline" className={statusColors[expense.status] || 'bg-muted'}>
              {expense.status}
            </Badge>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1 px-6 py-4">
          <div className="space-y-6">
            {/* Amount & Category */}
            <div className="bg-card border rounded-lg p-4 shadow-sm text-center">
              <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                {expense.category}
              </div>
              <div className="text-4xl font-black text-primary">
                ₹{Number(expense.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
            </div>

            {/* Info List */}
            <div className="space-y-3 bg-muted/30 p-4 rounded-lg border">
              <div className="flex items-center gap-3">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">{expense.profiles?.name || 'Unknown SE'}</span>
              </div>
              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">{new Date(expense.date).toLocaleString()}</span>
              </div>
              {expense.remarks && (
                <div className="flex items-start gap-3">
                  <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <span className="text-sm text-muted-foreground italic">"{expense.remarks}"</span>
                </div>
              )}
            </div>

            {/* 🚀 NEW: Distance Tracking Audit Card (Only shows for Travel expenses) */}
            {isTravel && shift && (
              <div className="bg-blue-50/50 border border-blue-100 rounded-lg p-4 shadow-sm">
                <h4 className="text-sm font-bold text-blue-900 mb-3 flex items-center gap-2">
                  <Navigation className="h-4 w-4" /> Shift Distance Audit
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white p-3 rounded-md border shadow-sm text-center">
                    <div className="text-xs text-muted-foreground uppercase font-semibold mb-1">Manual Reading</div>
                    <div className="text-lg font-black text-blue-950">
                      {manualKm > 0 ? manualKm.toFixed(1) : '-'} <span className="text-sm font-semibold">km</span>
                    </div>
                    <div className="text-[10px] font-medium text-muted-foreground mt-1">
                      {shift.start_km || 0} → {shift.end_km || 0}
                    </div>
                  </div>
                  <div className="bg-white p-3 rounded-md border shadow-sm text-center">
                    <div className="text-xs text-muted-foreground uppercase font-semibold mb-1 flex items-center justify-center gap-1">
                      <Map className="h-3 w-3" /> GPS Logged
                    </div>
                    <div className="text-lg font-black text-blue-950">
                      {gpsKm.toFixed(1)} <span className="text-sm font-semibold">km</span>
                    </div>
                    <div className="text-[10px] font-medium text-muted-foreground mt-1">
                      System calculated
                    </div>
                  </div>
                </div>
                {/* Optional Warning if mismatch is huge (e.g. > 10% difference) */}
                {manualKm > 0 && Math.abs(manualKm - gpsKm) > (gpsKm * 0.15) && (
                  <div className="mt-3 text-xs font-semibold text-red-600 bg-red-50 p-2 rounded border border-red-100 text-center">
                    ⚠️ High variance detected between Manual & GPS logs.
                  </div>
                )}
              </div>
            )}

            {/* Receipt Image */}
            <div className="space-y-2">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <Receipt className="h-4 w-4" /> Attached Receipt
              </h4>
              <div className="border rounded-lg overflow-hidden bg-muted flex items-center justify-center min-h-[250px]">
                {expense.receipt_url ? (
                  <img 
                    src={expense.receipt_url} 
                    alt="Receipt" 
                    className="w-full h-auto max-h-[400px] object-contain cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={() => window.open(expense.receipt_url, '_blank')}
                  />
                ) : (
                  <span className="text-muted-foreground text-sm">No receipt image provided.</span>
                )}
              </div>
              {expense.receipt_url && (
                <p className="text-xs text-muted-foreground text-center mt-1">Click image to open in full size.</p>
              )}
            </div>
          </div>
        </ScrollArea>

        {/* Action Buttons */}
        {canEdit && (
          <div className="p-4 border-t bg-card grid grid-cols-3 gap-2">
            <Button 
              variant="outline" 
              className="bg-red-50 text-red-700 hover:bg-red-100 hover:text-red-800 border-red-200"
              onClick={() => handleUpdateStatus('Rejected')}
              disabled={updating || expense.status === 'Rejected'}
            >
              <XCircle className="h-4 w-4 mr-1.5" /> Reject
            </Button>
            <Button 
              variant="outline" 
              className="bg-blue-50 text-blue-700 hover:bg-blue-100 hover:text-blue-800 border-blue-200"
              onClick={() => handleUpdateStatus('Queried')}
              disabled={updating || expense.status === 'Queried'}
            >
              <HelpCircle className="h-4 w-4 mr-1.5" /> Query
            </Button>
            <Button 
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={() => handleUpdateStatus('Approved')}
              disabled={updating || expense.status === 'Approved'}
            >
              <CheckCircle className="h-4 w-4 mr-1.5" /> Approve
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};