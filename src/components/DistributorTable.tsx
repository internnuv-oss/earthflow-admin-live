import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { DataTable, DataTableColumn, DataTableFilter } from './DataTable';
import { MapPin, Phone, Building2 } from 'lucide-react';

export interface DistributorRow {
  id: string;
  se_id: string | null;
  firm_name: string | null;
  owner_name: string | null;
  contact_mobile: string | null;
  city: string | null;
  state: string | null;
  band: string | null;
  total_score: number | null;
  status: string | null;
  created_at: string;
  pdf_url?: string | null;
  address?: string | null;
  gst_number?: string | null;
  pan_number?: string | null;
  firm_type?: string | null;
  est_year?: string | null;
  taluka?: string | null;
  pincode?: string | null;
  email?: string | null;
  contact_person?: string | null;
  bank_details?: any; scoring?: any; business_scope?: any; dealer_network?: any;
  commitments?: any; documents?: any; annexures?: any; raw_data?: any;
  profiles?: { name: string | null } | null;
}

// --- DATA SCANNING FUNCTIONS ---

const getUniqueBands = (rows: DistributorRow[]) => {
  const bands = new Set<string>();
  rows.forEach(r => {
    if (r.band && r.band !== '—') bands.add(r.band);
  });
  return Array.from(bands).map(b => ({ value: b, label: b }));
};

const getUniqueStatuses = (rows: DistributorRow[]) => {
  const statuses = new Set<string>();
  rows.forEach(r => {
    if (r.status) statuses.add(r.status);
  });
  return Array.from(statuses).map(s => ({ value: s, label: s }));
};

const bandVariant = (b?: string | null) => {
  if (!b) return 'secondary' as const;
  const v = b.toLowerCase();
  if (v.includes('green') || v === 'a') return 'default' as const;
  if (v.includes('red') || v === 'c') return 'destructive' as const;
  return 'secondary' as const;
};

interface DistributorTableProps {
  rows: DistributorRow[];
  onSelect: (r: DistributorRow) => void;
  seOptions?: { value: string; label: string }[];
}

const DistributorTable = ({ rows, onSelect, seOptions = [] }: DistributorTableProps) => {
  
  // Define Filters
  const filters: DataTableFilter<DistributorRow>[] = useMemo(() => [
    {
      key: 'status',
      label: 'Status',
      options: getUniqueStatuses(rows),
      predicate: (row, values) => values.includes(row.status as string),
    },
    {
      key: 'band',
      label: 'Band',
      options: getUniqueBands(rows),
      predicate: (row, values) => values.includes(row.band as string),
    },
    {
      key: 'se',
      label: 'Onboarded By',
      options: seOptions.length > 0 ? seOptions : [],
      predicate: (row, values) => values.includes(row.profiles?.name as string),
    }
  ], [rows, seOptions]);

  // Define Columns with SORTING enabled
  const columns: DataTableColumn<DistributorRow>[] = [
    {
      key: 'firm_name', header: 'Firm Name', 
      sortable: true, 
      sortValue: r => (r?.firm_name || '').toLowerCase(),
      accessor: r => (
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="font-medium">{r?.firm_name || 'Unnamed'}</span>
        </div>
      ),
    },
    { 
      key: 'owner_name', header: 'Owner', 
      sortable: true, 
      sortValue: r => (r?.owner_name || '').toLowerCase(),
      accessor: r => r?.owner_name || '—' 
    },
    {
      key: 'contact_mobile', header: 'Mobile',
      sortable: true,
      sortValue: r => r?.contact_mobile || '',
      accessor: r => r?.contact_mobile ? (
        <span className="inline-flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 text-muted-foreground" />{r.contact_mobile}</span>
      ) : '—',
    },
    {
      key: 'city', header: 'City',
      sortable: true,
      sortValue: r => ([r?.city, r?.state].filter(Boolean).join(', ')).toLowerCase(),
      accessor: r => (
        <span className="inline-flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
          {[r?.city, r?.state].filter(Boolean).join(', ') || '—'}
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
      key: 'band', header: 'Band / Score', className: 'text-center', headerClassName: 'font-semibold text-center',
      sortable: true,
      sortValue: r => r?.total_score || 0, // Sorting by numeric score is usually better than sorting alphabetically by Band letter
      accessor: r => (
        <div className="flex flex-col items-center gap-0.5">
          <Badge variant={bandVariant(r?.band)}>{r?.band || 'N/A'}</Badge>
          {r?.total_score != null && <span className="text-xs text-muted-foreground">{r.total_score}</span>}
        </div>
      ),
    },
    {
      key: 'status', header: 'Status', className: 'text-center', headerClassName: 'font-semibold text-center',
      sortable: true,
      sortValue: r => (r?.status || '').toLowerCase(),
      accessor: r => {
        if (r?.status === 'DRAFT') {
           return <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100 border-orange-200" variant="outline">Saved Draft</Badge>;
        }
        
        const colors: Record<string, string> = { 
          APPROVED: 'bg-green-500/10 text-green-700 hover:bg-green-500/20 border-green-200', 
          REJECTED: 'bg-red-500/10 text-red-700 hover:bg-red-500/20 border-red-200', 
          SUBMITTED: 'bg-blue-500/10 text-blue-700 hover:bg-blue-500/20 border-blue-200' 
        };
        return <Badge className={colors[r?.status || ''] || 'bg-gray-100 text-gray-700'} variant="outline">{r?.status || 'Pending'}</Badge>;
      },
    },
  ];

  return (
    <DataTable
      data={rows || []}
      columns={columns}
      filters={filters}
      searchPlaceholder="Search distributors..."
      searchAccessor={r => `${r?.firm_name || ''} ${r?.owner_name || ''} ${r?.contact_mobile || ''} ${r?.city || ''} ${r?.profiles?.name || ''}`}
      rowKey={r => r.id}
      onRowClick={onSelect}
      emptyMessage="No distributors found."
    />
  );
};

export default DistributorTable;