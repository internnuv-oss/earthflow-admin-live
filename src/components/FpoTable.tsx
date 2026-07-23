import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { DataTable, DataTableColumn, DataTableFilter } from './DataTable';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MapPin, Phone, Building2, Calendar as CalendarIcon } from 'lucide-react';

export interface FpoRow {
  id: string;
  se_id: string | null;
  fpo_name: string | null;
  ceo_name?: string | null;
  contact_mobile: string | null;
  city: string | null;
  state: string | null;
  taluka?: string | null;
  status: string | null;
  created_at: string;
  pdf_url?: string | null;
  address?: string | null;
  registration_number?: string | null;
  total_score?: number | null;
  band?: string | null;
  profiles?: { name: string | null } | null;
  [key: string]: any; // Allow other JSON fields
}

const getUniqueLocations = (rows: FpoRow[], key: 'city' | 'state' | 'taluka') => {
  const items = new Set<string>();
  rows.forEach(r => {
    if (r[key] && r[key] !== '—') items.add(r[key] as string);
  });
  return Array.from(items).map(v => ({ value: v, label: v }));
};

const getUniqueStatuses = (rows: FpoRow[]) => {
  const statuses = new Set<string>();
  rows.forEach(r => {
    if (r.status) statuses.add(r.status);
  });
  return Array.from(statuses).map(s => ({ value: s, label: s }));
};

interface FpoTableProps {
  rows: FpoRow[];
  onSelect: (r: FpoRow) => void;
  seOptions?: { value: string; label: string }[];
  onFilteredDataChange?: (data: FpoRow[]) => void;
  canEdit?: boolean;
}

const FpoTable = ({ rows, onSelect, seOptions = [], onFilteredDataChange }: FpoTableProps) => {
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

  const filters: DataTableFilter<FpoRow>[] = useMemo(() => [
    {
      key: 'status', label: 'Status',
      options: getUniqueStatuses(dateFilteredRows),
      predicate: (row, values) => values.includes(row.status as string),
    },
    {
      key: 'state', label: 'State',
      options: getUniqueLocations(dateFilteredRows, 'state'),
      predicate: (row, values) => values.includes(row.state as string),
    },
    {
      key: 'city', label: 'District',
      options: getUniqueLocations(dateFilteredRows, 'city'),
      predicate: (row, values) => values.includes(row.city as string),
    },
    {
      key: 'se', label: 'Onboarded By',
      options: seOptions.length > 0 ? seOptions : [],
      predicate: (row, values) => values.includes(row.profiles?.name as string),
    }
  ], [dateFilteredRows, seOptions]);

  const columns: DataTableColumn<FpoRow>[] = useMemo(() => [
    {
      key: 'fpo_name', header: 'FPO Name', 
      sortable: true, sortValue: r => (r?.fpo_name || '').toLowerCase(),
      accessor: r => (
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-700 shrink-0">
            <Building2 className="h-4 w-4" />
          </div>
          <div className="flex flex-col">
             <span className="font-semibold text-sm">{r?.fpo_name || 'Unnamed FPO'}</span>
             <span className="text-xs text-muted-foreground">{r?.registration_number ? `Reg: ${r.registration_number}` : 'No Reg #'}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'mobile', header: 'Contact', 
      sortable: true, sortValue: r => r?.contact_mobile || '',
      accessor: r => r?.contact_mobile ? (
        <span className="inline-flex items-center gap-1.5 font-medium"><Phone className="h-3.5 w-3.5 text-muted-foreground" />{r.contact_mobile}</span>
      ) : '—',
    },
    {
      key: 'location', header: 'Location', 
      sortable: true, sortValue: r => (`${r?.city} ${r?.state}`).toLowerCase(),
      accessor: r => (
        <div className="flex flex-col">
          <span className="inline-flex items-center gap-1.5 font-medium">
            <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            {r?.city || '—'}
          </span>
          <span className="text-xs text-muted-foreground ml-5">
            {r?.state || '—'}
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
    {
      key: 'status', header: 'Status', className: 'text-center', headerClassName: 'font-semibold text-center', 
      sortable: true, sortValue: r => (r?.status || '').toLowerCase(),
      accessor: r => r?.status === 'DRAFT' 
        ? <Badge className="bg-orange-100 text-orange-700 border-orange-200" variant="outline">Draft</Badge>
        : <Badge variant={r?.status === 'SUBMITTED' ? 'default' : 'secondary'}>{r?.status || 'Pending'}</Badge>,
    },
  ], []);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 p-4 bg-muted/30 rounded-lg border border-border">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-1 w-full sm:w-auto">
          <CalendarIcon className="h-4 w-4" /> Filter by Date:
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
          <button onClick={() => { setStartDate(''); setEndDate(''); }} className="text-xs text-primary hover:underline mt-2 sm:mt-0 sm:ml-2 font-medium">Clear Dates</button>
        )}
      </div>

      <DataTable
        data={dateFilteredRows}
        columns={columns}
        filters={filters}
        searchPlaceholder="Search FPOs (Name, City, Mobile)..."
        searchAccessor={r => `${r?.fpo_name || ''} ${r?.contact_mobile || ''} ${r?.city || ''} ${r?.state || ''} ${r?.profiles?.name || ''}`}
        rowKey={r => r.id}
        onRowClick={onSelect}
        emptyMessage="No FPOs found."
        onFilteredDataChange={onFilteredDataChange}
      />
    </div>
  );
};

export default FpoTable;