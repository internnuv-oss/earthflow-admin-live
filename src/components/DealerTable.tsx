import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { DataTable, DataTableColumn, DataTableFilter } from './DataTable';
import { MapPin, Phone, Store } from 'lucide-react';

export interface DealerRow {
  id: string;
  se_id: string | null;
  primary_shop_name: string | null;
  contact_person: string | null;
  contact_mobile: string | null;
  primary_address: string | null;
  category: string | null;
  status: string | null;
  total_score: number | null;
  created_at: string;
  pdf_url?: string | null;
  gst_number?: string | null;
  pan_number?: string | null;
  est_year?: string | null;
  firm_type?: string | null;
  bank_details?: any; scoring?: any; commitments?: any; documents?: any; annexures?: any;
  owners_list?: any; additional_locations?: any; distributor_links?: any; demo_farmers_data?: any;
  primary_shop_location?: any;
  profiles?: { name: string | null } | null;
}

// --- DATA SCANNING FUNCTIONS ---

const getUniqueCategories = (rows: DealerRow[]) => {
  const categories = new Set<string>();
  rows.forEach(r => {
    if (r.category && r.category !== '—') categories.add(r.category);
  });
  return Array.from(categories).map(c => ({ value: c, label: c }));
};

const getUniqueStatuses = (rows: DealerRow[]) => {
  const statuses = new Set<string>();
  rows.forEach(r => {
    if (r.status) statuses.add(r.status);
  });
  return Array.from(statuses).map(s => ({ value: s, label: s }));
};

const categoryVariant = (c?: string | null) => {
  if (!c) return 'secondary' as const;
  const v = c.toLowerCase();
  if (v.includes('platinum') || v.includes('gold') || v.includes('a')) return 'default' as const;
  if (v.includes('red') || v.includes('c')) return 'destructive' as const;
  return 'secondary' as const;
};

// Added seOptions to props
interface DealerTableProps {
  rows: DealerRow[];
  onSelect: (r: DealerRow) => void;
  seOptions?: { value: string; label: string }[];
}

const DealerTable = ({ rows, onSelect, seOptions = [] }: DealerTableProps) => {

  // Define Filters
  const filters: DataTableFilter<DealerRow>[] = useMemo(() => [
    {
      key: 'status',
      label: 'Status',
      options: getUniqueStatuses(rows),
      predicate: (row, value) => row.status === value,
    },
    {
      key: 'category',
      label: 'Category',
      options: getUniqueCategories(rows),
      predicate: (row, value) => row.category === value,
    },
    {
      key: 'se',
      label: 'Onboarded By',
      options: seOptions.length > 0 ? seOptions : [],
      predicate: (row, value) => row.profiles?.name === value,
    }
  ], [rows, seOptions]);

  // Define Columns with SORTING enabled
  const columns: DataTableColumn<DealerRow>[] = [
    {
      key: 'primary_shop_name', header: 'Shop Name', 
      sortable: true,
      sortValue: r => (r?.primary_shop_name || '').toLowerCase(),
      accessor: r => (
        <div className="flex items-center gap-2">
          <Store className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="font-medium">{r?.primary_shop_name || 'Unnamed'}</span>
        </div>
      ),
    },
    { 
      key: 'contact_person', header: 'Contact Person', 
      sortable: true,
      sortValue: r => (r?.contact_person || '').toLowerCase(),
      accessor: r => r?.contact_person || '—' 
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
      key: 'primary_address', header: 'Address',
      sortable: true,
      sortValue: r => (r?.primary_address || '').toLowerCase(),
      accessor: r => (
        <span className="inline-flex items-center gap-1.5 max-w-[260px] truncate">
          <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="truncate">{r?.primary_address || '—'}</span>
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
      key: 'category', header: 'Category', className: 'text-center', headerClassName: 'font-semibold text-center',
      sortable: true,
      sortValue: r => (r?.category || '').toLowerCase(),
      accessor: r => <Badge variant={categoryVariant(r?.category)}>{r?.category || 'N/A'}</Badge>,
    },
    {
      key: 'status', header: 'Status', className: 'text-center', headerClassName: 'font-semibold text-center',
      sortable: true,
      sortValue: r => (r?.status || '').toLowerCase(),
      accessor: r => r?.status === 'DRAFT' 
        ? <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100 border-orange-200" variant="outline">Saved Draft</Badge>
        : <Badge variant={r?.status === 'APPROVED' ? 'default' : 'secondary'}>{r?.status || 'Pending'}</Badge>,
    },
  ];

  return (
    <DataTable
      data={rows || []}
      columns={columns}
      filters={filters}
      searchPlaceholder="Search dealers..."
      // Make sure search includes SE names so the main bar is highly functional
      searchAccessor={r => `${r?.primary_shop_name || ''} ${r?.contact_person || ''} ${r?.contact_mobile || ''} ${r?.primary_address || ''} ${r?.profiles?.name || ''}`}
      rowKey={r => r.id}
      onRowClick={onSelect}
      emptyMessage="No dealers found."
    />
  );
};

export default DealerTable;