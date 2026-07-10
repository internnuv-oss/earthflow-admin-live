import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/AppLayout';
import { AttendanceTimelineSheet } from '@/components/AttendanceTimelineSheet';
import { Loader2, ChevronLeft, ChevronRight, Calendar as CalendarIcon, Shield, Search, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { usePermissions } from '@/hooks/usePermissions';

// Helper to format date safely to YYYY-MM-DD
const toYYYYMMDD = (date: Date) => {
  const d = new Date(date.getTime() - (date.getTimezoneOffset() * 60000));
  return d.toISOString().split('T')[0];
};

// 🚀 NEW: Intelligent Attendance Rule Engine
const getAttendanceInfo = (shift: any) => {
  if (!shift) return { status: 'Absent', short: 'A', color: 'bg-red-100 text-red-700 border-red-200 hover:bg-red-200' };
  
  // If they haven't punched out yet
  if (!shift.end_time) return { status: 'Active Shift', short: 'ON', color: 'bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200' };

  const totalHours = (shift.end_time - shift.start_time) / 3600000; // Convert ms to hours
  const logoutDate = new Date(shift.end_time);
  const logoutDecimal = logoutDate.getHours() + (logoutDate.getMinutes() / 60);

  // Rule 3: If completed more than 7.5 hours, consider it a full day
  if (totalHours > 7.5) {
    return { status: 'Full Day', short: 'P', color: 'bg-green-100 text-green-700 border-green-200 hover:bg-green-200' };
  }
  
  // Rule 1: If logged out between 1:00 PM (13.0) and 2:30 PM (14.5), consider it a half day
  if (logoutDecimal >= 13.0 && logoutDecimal <= 14.5) {
    return { status: 'Half Day', short: 'HD', color: 'bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-200' };
  }
  
  // Rule 2 & 4: Logged out before 1:00 PM OR after 2:30 PM (with < 7.5 hours) -> Show Total Hours
  return { 
    status: `${totalHours.toFixed(1)} Hours`, 
    short: `${totalHours.toFixed(1)}h`, 
    color: 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200' 
  };
};

const AttendancePage = ({ onLogout }: { onLogout: () => void }) => {
  const { session, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const userId = session?.user?.id;
  
  const { getModulePerm, loading: permLoading } = usePermissions(userId || '');
  const attendanceAccess = getModulePerm('attendance');

  const [loading, setLoading] = useState(true);
  const [seList, setSeList] = useState<{id: string, name: string}[]>([]);
  const [shiftsMap, setShiftsMap] = useState<Record<string, Record<string, any>>>({});
  
  // Search and Pagination State
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;
  
  // Export State
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportMonth, setExportMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  
  // Week Navigation State
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1); // Get Monday
    return new Date(today.setDate(diff));
  });

  const [selectedShift, setSelectedShift] = useState<{ shift: any, seName: string } | null>(null);

  const weekDays = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(currentWeekStart);
    d.setDate(currentWeekStart.getDate() + i);
    return d;
  });

  const todayStr = toYYYYMMDD(new Date());

  useEffect(() => {
    if (!userId || !attendanceAccess.can_view) return;

    const fetchData = async () => {
      setLoading(true);
      
      const startDateStr = toYYYYMMDD(weekDays[0]);
      const endDateStr = toYYYYMMDD(weekDays[6]);

      const [profilesRes, shiftsRes] = await Promise.all([
        supabase.from('profiles').select('id, name').eq('role', 'SE').eq('is_demo', false).order('name'),
        supabase.from('shifts')
          .select('*')
          .gte('date', startDateStr)
          .lte('date', endDateStr)
      ]);

      if (profilesRes.data) {
        setSeList(profilesRes.data);
      }

      if (shiftsRes.data) {
        const map: Record<string, Record<string, any>> = {};
        shiftsRes.data.forEach(shift => {
          if (!map[shift.se_id]) map[shift.se_id] = {};
          map[shift.se_id][shift.date] = shift;
        });
        setShiftsMap(map);
      }

      setLoading(false);
    };

    fetchData();
  }, [currentWeekStart, userId, attendanceAccess.can_view]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const shiftWeek = (offset: number) => {
    const newStart = new Date(currentWeekStart);
    newStart.setDate(currentWeekStart.getDate() + (offset * 7));
    setCurrentWeekStart(newStart);
  };

  // Monthly CSV Export Logic
  const handleExportMonthlyAttendance = async () => {
    setExporting(true);
    try {
      const [year, month] = exportMonth.split('-');
      const daysInMonth = new Date(parseInt(year), parseInt(month), 0).getDate();
      
      const startDate = `${exportMonth}-01`;
      const endDate = `${exportMonth}-${daysInMonth}`;

      // 1. Fetch all SEs
      const { data: profiles, error: pErr } = await supabase
        .from('profiles')
        .select('id, name')
        .eq('role', 'SE')
        .eq('is_demo', false)
        .order('name');
      if (pErr) throw pErr;

      // 2. Fetch all shifts for the entire month
      const { data: shifts, error: sErr } = await supabase
        .from('shifts')
        .select('se_id, date, start_time, end_time')
        .gte('date', startDate)
        .lte('date', endDate);
      if (sErr) throw sErr;

      // 3. Map shifts to SEs by Date
      const shiftMap: Record<string, Record<string, any>> = {};
      (shifts || []).forEach(s => {
        if (!shiftMap[s.se_id]) shiftMap[s.se_id] = {};
        shiftMap[s.se_id][s.date] = s;
      });

      // 4. Build CSV Headers
      const headers = ['Executive Name', ...Array.from({ length: daysInMonth }, (_, i) => i + 1), 'Days Present'];
      const csvRows = [headers.join(',')];

      // 5. Build CSV Rows (Applying the new rules!)
      (profiles || []).forEach(se => {
        const row = [`"${se.name}"`];
        let presentCount = 0;

        for (let i = 1; i <= daysInMonth; i++) {
          const dateStr = `${exportMonth}-${String(i).padStart(2, '0')}`;
          
          if (dateStr > todayStr) {
            row.push('-'); // Future dates
          } else if (shiftMap[se.id] && shiftMap[se.id][dateStr]) {
            // Apply the smart logic to the CSV
            const info = getAttendanceInfo(shiftMap[se.id][dateStr]);
            row.push(`"${info.status}"`);
            presentCount++;
          } else {
            row.push('Absent');
          }
        }
        
        row.push(presentCount.toString());
        csvRows.push(row.join(','));
      });

      // 6. Trigger Download
      const blob = new Blob(['\uFEFF' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Monthly_Attendance_${exportMonth}.csv`;
      link.click();
      window.URL.revokeObjectURL(url);
      
      setExportOpen(false);
      toast({ title: 'Export Successful', description: 'Your attendance report has been downloaded.' });
    } catch (err: any) {
      toast({ title: 'Export Failed', description: err.message, variant: 'destructive' });
    } finally {
      setExporting(false);
    }
  };

  const filteredSEs = seList.filter(se => 
    (se.name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  const totalPages = Math.ceil(filteredSEs.length / ITEMS_PER_PAGE) || 1;
  const paginatedSEs = filteredSEs.slice(
    (currentPage - 1) * ITEMS_PER_PAGE, 
    currentPage * ITEMS_PER_PAGE
  );

  if (authLoading || permLoading) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!attendanceAccess.can_view) {
    return (
      <AppLayout onLogout={onLogout}>
        <div className="flex flex-col items-center justify-center h-[60vh] text-center">
          <Shield className="h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold">Access Denied</h2>
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
            <h2 className="text-xl font-bold">Attendance Dashboard</h2>
            <p className="text-sm text-muted-foreground">Monitor daily shift punches and field timelines.</p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
            {/* Search Bar */}
            <div className="relative w-full sm:w-64 shrink-0">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search Executive..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 w-full"
              />
            </div>

            {/* Week Nav */}
            <div className="flex items-center gap-1 bg-card border rounded-lg p-1 shadow-sm shrink-0 w-full justify-between sm:w-auto sm:justify-start">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => shiftWeek(-1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="flex items-center gap-2 px-2 text-sm font-semibold">
                <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                {weekDays[0].toLocaleDateString([], { month: 'short', day: 'numeric' })} - {weekDays[6].toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => shiftWeek(1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Download Button */}
            <Button 
              variant="outline" 
              className="bg-green-50 text-green-700 hover:bg-green-100 border-green-200 w-full sm:w-auto"
              onClick={() => setExportOpen(true)}
            >
              <Download className="h-4 w-4 mr-2" /> Export
            </Button>
          </div>
        </div>

        {/* The Weekly Grid */}
        <div className="bg-card border rounded-lg shadow-sm flex flex-col">
          <div className="overflow-x-auto">
            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : (
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="px-4 py-3 font-semibold text-muted-foreground min-w-[200px]">Executive</th>
                    {weekDays.map(day => (
                      <th key={day.toISOString()} className="px-2 py-3 text-center min-w-[65px]">
                        <div className="text-xs font-semibold uppercase text-muted-foreground">
                          {day.toLocaleDateString([], { weekday: 'short' })}
                        </div>
                        <div className="text-sm font-bold">
                          {day.getDate()}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {paginatedSEs.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-muted-foreground">
                        No executives found.
                      </td>
                    </tr>
                  ) : (
                    paginatedSEs.map((se) => (
                      <tr key={se.id} className="hover:bg-muted/20">
                        <td className="px-4 py-3 font-medium">{se.name}</td>
                        
                        {weekDays.map(day => {
                          const dateStr = toYYYYMMDD(day);
                          const shift = shiftsMap[se.id]?.[dateStr];
                          const isFuture = dateStr > todayStr;
                          
                          // Process UI rendering with the logic
                          const info = getAttendanceInfo(shift);

                          return (
                            <td key={dateStr} className="px-2 py-3 text-center">
                              {isFuture ? (
                                <span className="text-muted-foreground/30 font-bold">-</span>
                              ) : shift ? (
                                <button 
                                  onClick={() => setSelectedShift({ shift, seName: se.name })}
                                  className={`w-10 h-8 mx-auto rounded flex items-center justify-center font-bold border transition-colors text-[11px] ${info.color}`}
                                  title={`${info.status} - Click for Timeline`}
                                >
                                  {info.short}
                                </button>
                              ) : (
                                <div className={`w-10 h-8 mx-auto rounded flex items-center justify-center font-bold border text-[11px] ${info.color}`} title="Absent">
                                  {info.short}
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination Footer */}
          {!loading && filteredSEs.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between px-4 py-3 border-t bg-muted/20 gap-3">
              <div className="text-xs text-muted-foreground font-medium">
                Showing <span className="text-foreground">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> to <span className="text-foreground">{Math.min(currentPage * ITEMS_PER_PAGE, filteredSEs.length)}</span> of <span className="text-foreground">{filteredSEs.length}</span> entries
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="h-8 px-3 text-xs" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>Previous</Button>
                <div className="text-xs font-semibold px-2">Page {currentPage} of {totalPages}</div>
                <Button variant="outline" size="sm" className="h-8 px-3 text-xs" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Next</Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <AttendanceTimelineSheet 
        open={!!selectedShift}
        shift={selectedShift?.shift}
        seName={selectedShift?.seName || ''}
        onClose={() => setSelectedShift(null)}
      />

      {/* Export Month Selector Dialog */}
      <Dialog open={exportOpen} onOpenChange={setExportOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Export Monthly Attendance</DialogTitle>
            <DialogDescription>
              Select a month to download a complete attendance matrix for all Sales Executives.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label>Select Month</Label>
              <Input 
                type="month" 
                value={exportMonth} 
                onChange={(e) => setExportMonth(e.target.value)} 
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setExportOpen(false)}>Cancel</Button>
            <Button onClick={handleExportMonthlyAttendance} disabled={exporting}>
              {exporting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {exporting ? 'Generating...' : 'Download CSV'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default AttendancePage;