import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { DataTable, DataTableColumn, DataTableFilter } from './DataTable';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MapPin, Phone, User, Calendar as CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface FarmerRow {
  id: string;
  se_id: string | null;
  dealer_id: string | null;
  full_name: string | null;
  mobile: string | null;
  village: string | null;
  district?: string | null;
  taluka?: string | null;
  status: string | null;
  created_at: string;
  pdf_url?: string | null;
  personal_details?: any;
  farm_details?: any;
  history_details?: any;
  update_history?: any;
  profiles?: { name: string | null } | null;
  fspp_details?: any;
  has_farm_card?: boolean;
}

// 🚀 HELPER: Strictly calculates the 3 main Lifecycle Stages
export const getFarmerStage = (r: FarmerRow) => {
  if (r.has_farm_card) return 'Farm Card';
  if (r.fspp_details && Object.keys(r.fspp_details).length > 0) return 'FSPP';
  return 'Onboarding'; // Everything before FSPP (including Drafts) is technically Onboarding
};

// 🚀 EXPORTED FOR TERRITORY ROUTE: Visual progress bar (Safely handles the 3 new stages)
export const StageProgressBar = ({ stage }: { stage: string }) => {
  const level = stage === 'Farm Card' ? 3 : stage === 'FSPP' ? 2 : 1;

  return (
    <div className="flex items-center pt-5 pb-1 w-[200px]">
      <div className="relative flex flex-col items-center z-10">
        <span className={cn("absolute -top-4 text-[10px] font-bold italic tracking-tight", level >= 1 ? "text-green-600" : "text-gray-400")}>Onboarding</span>
        <div className={cn("h-4 w-4 rounded-full", level >= 1 ? "bg-green-500" : "bg-gray-200")} />
      </div>
      <div className={cn("flex-1 h-[3px] -mx-1 z-0", level >= 2 ? "bg-green-500" : "bg-gray-200")} />
      <div className="relative flex flex-col items-center z-10">
        <span className={cn("absolute -top-4 text-[10px] font-bold italic tracking-tight", level >= 2 ? "text-green-600" : "text-gray-400")}>FSPP</span>
        <div className={cn("h-4 w-4 rounded-full", level >= 2 ? "bg-green-500" : "bg-gray-200")} />
      </div>
      <div className={cn("flex-1 h-[3px] -mx-1 z-0", level >= 3 ? "bg-green-500" : "bg-gray-200")} />
      <div className="relative flex flex-col items-center z-10">
        <span className={cn("absolute -top-4 text-[10px] font-bold italic whitespace-nowrap tracking-tight", level >= 3 ? "text-green-600" : "text-gray-400")}>Farm Card</span>
        <div className={cn("h-4 w-4 rounded-full", level >= 3 ? "bg-green-500" : "bg-gray-200")} />
      </div>
    </div>
  );
};

const getUniqueLocations = (rows: FarmerRow[], key: 'district' | 'taluka' | 'village') => {
  const items = new Set<string>();
  rows.forEach(r => {
    if (r[key] && r[key] !== '—') items.add(r[key] as string);
  });
  return Array.from(items).map(v => ({ value: v, label: v }));
};

// 🚀 RESTORED: Status Filter Options
const getUniqueStatuses = (rows: FarmerRow[]) => {
  const statuses = new Set<string>();
  rows.forEach(r => {
    if (r.status) statuses.add(r.status);
  });
  return Array.from(statuses).map(s => ({ value: s, label: s }));
};

// 🚀 NEW: Stage Filter Options
const getUniqueStages = (rows: FarmerRow[]) => {
  const stages = new Set<string>();
  rows.forEach(r => stages.add(getFarmerStage(r)));
  return Array.from(stages).map(s => ({ value: s, label: s }));
};

interface FarmerTableProps {
  rows: FarmerRow[];
  onSelect: (r: FarmerRow) => void;
  seOptions?: { value: string; label: string }[];
  onFilteredDataChange?: (data: FarmerRow[]) => void;
  canEdit: boolean; 
  villageToRoute: Record<string, string>;
}

export const FarmerTable = ({ rows, onSelect, seOptions = [], onFilteredDataChange, canEdit, villageToRoute }: FarmerTableProps) => {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const dateFilteredRows = useMemo(() => {
    if (!startDate && !endDate) return rows;

    return rows.filter(row => {
      const rowDate = new Date(row.created_at);
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        if (rowDate < start) return false;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        if (rowDate > end) return false;
      }
      return true;
    });
  }, [rows, startDate, endDate]);

  const filters: DataTableFilter<FarmerRow>[] = useMemo(() => [
    // 🚀 RESTORED STATUS FILTER
    {
      key: 'status', label: 'Status',
      options: getUniqueStatuses(dateFilteredRows),
      predicate: (row, values) => values.includes(row.status as string),
    },
    // 🚀 NEW STAGE FILTER
    {
      key: 'stage', label: 'Stage', 
      options: getUniqueStages(dateFilteredRows),
      predicate: (row, values) => values.includes(getFarmerStage(row)),
    },
    {
      key: 'district', label: 'District',
      options: getUniqueLocations(dateFilteredRows, 'district'),
      predicate: (row, values) => values.includes(row.district as string),
    },
    {
      key: 'taluka', label: 'Taluka',
      options: getUniqueLocations(dateFilteredRows, 'taluka'),
      predicate: (row, values) => values.includes(row.taluka as string),
    },
    {
      key: 'village', label: 'Village',
      options: getUniqueLocations(dateFilteredRows, 'village'),
      predicate: (row, values) => values.includes(row.village as string),
    },
    {
      key: 'se', label: 'Onboarded By',
      options: seOptions.length > 0 ? seOptions : [],
      predicate: (row, values) => values.includes(row.profiles?.name as string),
    }
  ], [dateFilteredRows, seOptions]);

  const columns: DataTableColumn<FarmerRow>[] = useMemo(() => [
    {
      key: 'full_name', header: 'Full Name', 
      sortable: true, sortValue: r => (r?.full_name || '').toLowerCase(),
      accessor: r => (
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-primary shrink-0">
            <User className="h-4 w-4" />
          </div>
          <span className="font-medium">{r?.full_name || 'Unnamed'}</span>
        </div>
      ),
    },
    {
      key: 'mobile', header: 'Mobile', 
      sortable: true, sortValue: r => r?.mobile || '',
      accessor: r => r?.mobile ? (
        <span className="inline-flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 text-muted-foreground" />{r.mobile}</span>
      ) : '—',
    },
    {
      key: 'assigned_route', header: 'Route Name',
      sortable: true, sortValue: r => {
        const safeVillage = (r.village || '').trim().toLowerCase();
        return (villageToRoute[safeVillage] || 'Unassigned').toLowerCase();
      },
      accessor: r => {
        const safeVillage = (r.village || '').trim().toLowerCase();
        const routeName = villageToRoute[safeVillage];
        return (
          <span className={`font-semibold text-sm ${routeName ? 'text-primary' : 'text-muted-foreground italic'}`}>
            {routeName || 'Unassigned'}
          </span>
        );
      }
    },
    {
      key: 'location', header: 'Location', 
      sortable: true, sortValue: r => (`${r?.village} ${r?.taluka} ${r?.district}`).toLowerCase(),
      accessor: r => (
        <div className="flex flex-col">
          <span className="inline-flex items-center gap-1.5 font-medium">
            <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            {r?.village || '—'}
          </span>
          <span className="text-xs text-muted-foreground ml-5">
            {[r?.taluka, r?.district].filter(v => v && v !== '—').join(', ')}
          </span>
        </div>
      ),
    },
    { 
      key: 'se', header: 'Onboarded By', 
      sortable: true, sortValue: r => (r?.profiles?.name || '').toLowerCase(),
      accessor: r => <span className="text-muted-foreground text-sm font-medium">{r?.profiles?.name || '—'}</span> 
    },
    { 
      key: 'created_at', header: 'Date', 
      sortable: true, sortValue: r => new Date(r.created_at).getTime(),
      accessor: r => <span className="text-muted-foreground text-sm">{new Date(r.created_at).toLocaleDateString()}</span> 
    },
    // 🚀 RESTORED: Status Column (Draft vs Submitted)
    {
      key: 'status', header: 'Status', className: 'text-center', headerClassName: 'font-semibold text-center', 
      sortable: true, sortValue: r => (r?.status || '').toLowerCase(),
      accessor: r => r?.status === 'DRAFT' 
        ? <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100 border-orange-200" variant="outline">Saved Draft</Badge>
        : <Badge variant={r?.status === 'SUBMITTED' ? 'default' : 'secondary'}>{r?.status || 'Pending'}</Badge>,
    },
    // 🚀 NEW: Text-Based Stage Column
    {
      key: 'stage', header: 'Stage', className: 'text-center', headerClassName: 'font-semibold text-center', 
      sortable: true, sortValue: r => getFarmerStage(r).toLowerCase(),
      accessor: r => {
        const stage = getFarmerStage(r);
        if (stage === 'Farm Card') return <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-green-200">Farm Card</Badge>;
        if (stage === 'FSPP') return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-blue-200">FSPP Checked</Badge>;
        return <Badge variant="secondary" className="bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-100">Onboarding</Badge>; 
      }
    }
  ], [villageToRoute]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 p-4 bg-muted/30 rounded-lg border border-border">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-1 w-full sm:w-auto">
          <CalendarIcon className="h-4 w-4" /> Filter by Date Onboarded:
        </div>
        <div className="grid grid-cols-2 sm:flex sm:flex-row gap-2 items-center">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="startDate" className="text-xs text-muted-foreground">From</Label>
            <Input id="startDate" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full sm:w-[150px] h-9 text-sm" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="endDate" className="text-xs text-muted-foreground">To</Label>
            <Input id="endDate" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full sm:w-[150px] h-9 text-sm" />
          </div>
        </div>
        {(startDate || endDate) && (
          <button onClick={() => { setStartDate(''); setEndDate(''); }} className="text-xs text-primary hover:underline mt-2 sm:mt-0 sm:ml-2 font-medium">
            Clear Dates
          </button>
        )}
      </div>

      <DataTable
        data={dateFilteredRows}
        columns={columns}
        filters={filters}
        searchPlaceholder="Search farmers..."
        searchAccessor={r => `${r?.full_name || ''} ${r?.mobile || ''} ${r?.village || ''} ${r?.taluka || ''} ${r?.district || ''} ${r?.profiles?.name || ''}`}
        rowKey={r => r.id}
        onRowClick={onSelect}
        emptyMessage="No farmers found."
        onFilteredDataChange={onFilteredDataChange}
      />
    </div>
  );
};

export default FarmerTable;