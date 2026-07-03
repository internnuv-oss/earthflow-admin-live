import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';
import { Loader2, CheckCircle, XCircle, HelpCircle, Car, Clock, Navigation } from 'lucide-react';

interface Props {
  open: boolean;
  expense: any;
  onClose: () => void;
  onUpdate: (id: string, status: string) => void;
  canEdit: boolean;
}

export const ExpenseActionSheet = ({ open, expense, onClose, onUpdate, canEdit }: Props) => {
  const [updating, setUpdating] = useState(false);
  const { toast } = useToast();

  if (!expense) return null;

  const handleStatusChange = async (newStatus: string) => {
    setUpdating(true);
    const { error } = await supabase.from('expenses').update({ status: newStatus }).eq('id', expense.id);
    setUpdating(false);

    if (error) {
      toast({ title: 'Update Failed', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Expense Updated', description: `Status changed to ${newStatus}` });
      onUpdate(expense.id, newStatus);
      onClose();
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Approved': return 'bg-green-100 text-green-800 border-green-200';
      case 'Rejected': return 'bg-red-100 text-red-800 border-red-200';
      case 'Queried': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-amber-100 text-amber-800 border-amber-200';
    }
  };

  // Safe parsing for shift data
  const shift = expense.shifts;
  let odoDistance = 0;
  if (shift?.start_km && shift?.end_km) {
    const s = parseFloat(shift.start_km.replace(/[^0-9.]/g, ''));
    const e = parseFloat(shift.end_km.replace(/[^0-9.]/g, ''));
    if (!isNaN(s) && !isNaN(e) && e > s) odoDistance = parseFloat((e - s).toFixed(1));
  }
  
  const distanceUsed = odoDistance > 0 ? odoDistance : (shift?.total_distance || 0);
  const taAmount = distanceUsed * 4;
  const daAmount = distanceUsed > 60 ? 150 : 0;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-0">
        <SheetHeader className="px-6 py-5 border-b bg-muted/30">
          <div className="flex justify-between items-start">
            <div>
              <SheetTitle className="text-xl">Expense Review</SheetTitle>
              <SheetDescription className="font-medium text-primary mt-1">
                {expense.profiles?.name} • {new Date(expense.date).toLocaleDateString()}
              </SheetDescription>
            </div>
            <Badge variant="outline" className={getStatusColor(expense.status)}>{expense.status}</Badge>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          
          {/* Amount Overview */}
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 text-center">
            <p className="text-sm font-semibold text-primary uppercase">{expense.category}</p>
            <h2 className="text-4xl font-bold text-foreground mt-1">
              ₹{Number(expense.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </h2>
          </div>

          {/* 🚀 NEW: Auto-Generated Shift Breakdown */}
          {shift && expense.category === 'Total Allowance' && (
            <div className="space-y-4">
              <h4 className="text-sm font-bold flex items-center gap-2 border-b pb-2"><Car className="h-4 w-4" /> Travel Breakdown</h4>
              
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-card border rounded-lg p-3 text-center shadow-sm">
                  <Navigation className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase">Distance</span>
                  <p className="text-sm font-bold">{distanceUsed} km</p>
                </div>
                <div className="bg-card border rounded-lg p-3 text-center shadow-sm">
                  <Clock className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase">Duration</span>
                  <p className="text-sm font-bold">
                    {shift.end_time && shift.start_time ? `${((shift.end_time - shift.start_time) / 3600000).toFixed(1)} hrs` : 'N/A'}
                  </p>
                </div>
              </div>

              {/* Allowance Math */}
              <div className="bg-muted/30 rounded-md p-3 text-sm space-y-2 border">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Travel Allowance (₹4/km)</span>
                  <span className="font-semibold">₹{taAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Daily Allowance ({distanceUsed > 60 ? '> 60km' : '< 60km'})</span>
                  <span className="font-semibold">₹{daAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-t pt-2 mt-2 font-bold">
                  <span>Total Calculated</span>
                  <span>₹{(taAmount + daAmount).toFixed(2)}</span>
                </div>
              </div>

              {/* Odometer Photos */}
              {(shift.start_odo_image || shift.end_odo_image) && (
                <div className="grid grid-cols-2 gap-4 mt-4">
                  {shift.start_odo_image && (
                    <div className="flex flex-col gap-1.5">
                      <span className="text-xs font-semibold text-muted-foreground">Start: {shift.start_km || 'N/A'} km</span>
                      <a href={shift.start_odo_image} target="_blank" rel="noreferrer" className="block rounded-md border shadow-sm hover:opacity-90 overflow-hidden">
                        <img src={shift.start_odo_image} alt="Start Odo" className="w-full h-20 object-cover" />
                      </a>
                    </div>
                  )}
                  {shift.end_odo_image && (
                    <div className="flex flex-col gap-1.5">
                      <span className="text-xs font-semibold text-muted-foreground">End: {shift.end_km || 'N/A'} km</span>
                      <a href={shift.end_odo_image} target="_blank" rel="noreferrer" className="block rounded-md border shadow-sm hover:opacity-90 overflow-hidden">
                        <img src={shift.end_odo_image} alt="End Odo" className="w-full h-20 object-cover" />
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Standard Expense Details */}
          <div className="space-y-4">
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground font-semibold uppercase">Remarks</span>
              <p className="text-sm bg-muted/30 p-3 rounded-md border">{expense.remarks || 'No remarks provided.'}</p>
            </div>

            {expense.receipt_url && expense.receipt_url !== 'SYSTEM_GENERATED' && (
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground font-semibold uppercase">Attached Receipt</span>
                <a href={expense.receipt_url} target="_blank" rel="noreferrer" className="block mt-1">
                  <img src={expense.receipt_url} alt="Receipt" className="w-full max-h-48 object-contain rounded-lg border bg-muted" />
                </a>
              </div>
            )}
          </div>
        </div>

        {canEdit && expense.status === 'Pending' && (
          <SheetFooter className="px-6 py-4 border-t bg-muted/10 grid grid-cols-3 gap-3">
            <Button variant="outline" className="bg-red-50 text-red-700 hover:bg-red-100 border-red-200" disabled={updating} onClick={() => handleStatusChange('Rejected')}>
              <XCircle className="h-4 w-4 mr-2" /> Reject
            </Button>
            <Button variant="outline" className="bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200" disabled={updating} onClick={() => handleStatusChange('Queried')}>
              <HelpCircle className="h-4 w-4 mr-2" /> Query
            </Button>
            <Button className="bg-green-600 text-white hover:bg-green-700" disabled={updating} onClick={() => handleStatusChange('Approved')}>
              {updating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />} Approve
            </Button>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
};