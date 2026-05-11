import { Badge } from '@/components/ui/badge';
import { DataTable, DataTableColumn } from './DataTable';
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

const categoryVariant = (c?: string | null) => {
  if (!c) return 'secondary' as const;
  const v = c.toLowerCase();
  if (v.includes('platinum') || v.includes('gold') || v.includes('a')) return 'default' as const;
  if (v.includes('red') || v.includes('c')) return 'destructive' as const;
  return 'secondary' as const;
};

const DealerTable = ({ rows, onSelect }: { rows: DealerRow[]; onSelect: (r: DealerRow) => void }) => {
  const columns: DataTableColumn<DealerRow>[] = [
    {
      key: 'primary_shop_name', header: 'Shop Name', sortable: true,
      sortValue: r => (r?.primary_shop_name || '').toLowerCase(),
      accessor: r => (
        <div className="flex items-center gap-2">
          <Store className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="font-medium">{r?.primary_shop_name || 'Unnamed'}</span>
        </div>
      ),
    },
    { key: 'contact_person', header: 'Contact Person', accessor: r => r?.contact_person || '—' },
    {
      key: 'contact_mobile', header: 'Mobile',
      accessor: r => r?.contact_mobile ? (
        <span className="inline-flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 text-muted-foreground" />{r.contact_mobile}</span>
      ) : '—',
    },
    {
      key: 'primary_address', header: 'Address',
      accessor: r => (
        <span className="inline-flex items-center gap-1.5 max-w-[260px] truncate">
          <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="truncate">{r?.primary_address || '—'}</span>
        </span>
      ),
    },
    { key: 'se', header: 'Onboarded By', accessor: r => <span className="text-muted-foreground text-sm">{r?.profiles?.name || '—'}</span> },
    {
      key: 'category', header: 'Category', className: 'text-center', headerClassName: 'font-semibold text-center',
      accessor: r => <Badge variant={categoryVariant(r?.category)}>{r?.category || 'N/A'}</Badge>,
    },
    {
      key: 'status', header: 'Status', className: 'text-center', headerClassName: 'font-semibold text-center',
      accessor: r => <Badge variant={r?.status === 'APPROVED' ? 'default' : 'secondary'}>{r?.status || 'DRAFT'}</Badge>,
    },
  ];

  return (
    <DataTable
      data={rows || []}
      columns={columns}
      searchPlaceholder="Search dealers..."
      searchAccessor={r => `${r?.primary_shop_name || ''} ${r?.contact_person || ''} ${r?.contact_mobile || ''} ${r?.primary_address || ''}`}
      rowKey={r => r.id}
      onRowClick={onSelect}
      emptyMessage="No dealers found."
    />
  );
};

export default DealerTable;
