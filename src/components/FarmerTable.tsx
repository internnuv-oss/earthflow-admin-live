import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { DataTable, DataTableColumn, DataTableFilter } from './DataTable';
import { MapPin, Phone, User } from 'lucide-react';

export interface FarmerRow {
  id: string;
  se_id: string | null;
  dealer_id: string | null;
  full_name: string | null;
  mobile: string | null;
  village: string | null;
  status: string | null;
  created_at: string;
  pdf_url?: string | null;
  personal_details?: any;
  farm_details?: any;
  history_details?: any;
  profiles?: { name: string | null } | null;
}

const getUniqueVillages = (rows: FarmerRow[]) => {
  const villages = new Set<string>();
  rows.forEach(r => {
    if (r.village) villages.add(r.village);
  });
  return Array.from(villages).map(v => ({ value: v, label: v }));
};

const getUniqueStatuses = (rows: FarmerRow[]) => {
  const statuses = new Set<string>();
  rows.forEach(r => {
    if (r.status) statuses.add(r.status);
  });
  return Array.from(statuses).map(s => ({ value: s, label: s }));
};

// Added seOptions to props
interface FarmerTableProps {
  rows: FarmerRow[];
  onSelect: (r: FarmerRow) => void;
  seOptions?: { value: string; label: string }[];
}

const FarmerTable = ({ rows, onSelect, seOptions = [] }: FarmerTableProps) => {
  
  const filters: DataTableFilter<FarmerRow>[] = useMemo(() => [
    {
      key: 'status',
      label: 'Status',
      options: getUniqueStatuses(rows),
      predicate: (row, value) => row.status === value,
    },
    {
      key: 'village',
      label: 'Village',
      options: getUniqueVillages(rows),
      predicate: (row, value) => row.village === value,
    },
    {
      key: 'se',
      label: 'Onboarded By',
      // If we passed all 21 SEs, use them. Otherwise, fallback to scanning rows.
      options: seOptions.length > 0 ? seOptions : [],
      predicate: (row, value) => row.profiles?.name === value,
    }
  ], [rows, seOptions]);

  const columns: DataTableColumn<FarmerRow>[] = [
    {
      key: 'full_name', header: 'Full Name', 
      sortable: true,
      sortValue: r => (r?.full_name || '').toLowerCase(),
      accessor: r => (
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-primary">
            <User className="h-4 w-4" />
          </div>
          <span className="font-medium">{r?.full_name || 'Unnamed'}</span>
        </div>
      ),
    },
    {
      key: 'mobile', header: 'Mobile', 
      sortable: true,
      sortValue: r => r?.mobile || '',
      accessor: r => r?.mobile ? (
        <span className="inline-flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 text-muted-foreground" />{r.mobile}</span>
      ) : '—',
    },
    {
      key: 'village', header: 'Village', 
      sortable: true,
      sortValue: r => (r?.village || '').toLowerCase(),
      accessor: r => (
        <span className="inline-flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
          {r?.village || '—'}
        </span>
      ),
    },
    { 
      key: 'se', header: 'Onboarded By', 
      sortable: true,
      sortValue: r => (r?.profiles?.name || '').toLowerCase(),
      accessor: r => <span className="text-muted-foreground text-sm">{r?.profiles?.name || '—'}</span> 
    },
    {
      key: 'status', header: 'Status', className: 'text-center', headerClassName: 'font-semibold text-center', 
      sortable: true,
      sortValue: r => (r?.status || '').toLowerCase(),
      accessor: r => r?.status === 'DRAFT' 
        ? <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100 border-orange-200" variant="outline">Saved Draft</Badge>
        : <Badge variant={r?.status === 'SUBMITTED' ? 'default' : 'secondary'}>{r?.status || 'Pending'}</Badge>,
    },
  ];

  return (
    <DataTable
      data={rows || []}
      columns={columns}
      filters={filters}
      searchPlaceholder="Search farmers..."
      searchAccessor={r => `${r?.full_name || ''} ${r?.mobile || ''} ${r?.village || ''} ${r?.profiles?.name || ''}`}
      rowKey={r => r.id}
      onRowClick={onSelect}
      emptyMessage="No farmers found."
    />
  );
};

export default FarmerTable;