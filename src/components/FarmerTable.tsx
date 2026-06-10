import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { DataTable, DataTableColumn, DataTableFilter } from './DataTable';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MapPin, Phone, User, Calendar as CalendarIcon } from 'lucide-react';

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
}

const getUniqueLocations = (rows: FarmerRow[], key: 'district' | 'taluka' | 'village') => {
  const items = new Set<string>();
  rows.forEach(r => {
    if (r[key] && r[key] !== '—') items.add(r[key] as string);
  });
  return Array.from(items).map(v => ({ value: v, label: v }));
};

const getUniqueStatuses = (rows: FarmerRow[]) => {
  const statuses = new Set<string>();
  rows.forEach(r => {
    if (r.status) statuses.add(r.status);
  });
  return Array.from(statuses).map(s => ({ value: s, label: s }));
};

interface FarmerTableProps {
  rows: FarmerRow[];
  onSelect: (r: FarmerRow) => void;
  seOptions?: { value: string; label: string }[];
  onFilteredDataChange?: (data: FarmerRow[]) => void;
}

const FarmerTable = ({ rows, onSelect, seOptions = [], onFilteredDataChange }: FarmerTableProps) => {
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
    {
      key: 'status', label: 'Status',
      options: getUniqueStatuses(dateFilteredRows),
      // UPDATED PREDICATE LOGIC FOR MULTI-SELECT
      predicate: (row, values) => values.includes(row.status as string),
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

  // Wrap columns in useMemo to prevent re-creating references on every render
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
      accessor: r => <span className="text-muted-foreground text-sm">{r?.profiles?.name || '—'}</span> 
    },
    { 
      key: 'created_at', header: 'Date Onboarded', 
      sortable: true, sortValue: r => new Date(r.created_at).getTime(),
      accessor: r => <span className="text-muted-foreground text-sm">{new Date(r.created_at).toLocaleDateString()}</span> 
    },
    {
      key: 'status', header: 'Status', className: 'text-center', headerClassName: 'font-semibold text-center', 
      sortable: true, sortValue: r => (r?.status || '').toLowerCase(),
      accessor: r => r?.status === 'DRAFT' 
        ? <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100 border-orange-200" variant="outline">Saved Draft</Badge>
        : <Badge variant={r?.status === 'SUBMITTED' ? 'default' : 'secondary'}>{r?.status || 'Pending'}</Badge>,
    },
  ], []); // Empty dependencies because columns layout is static

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