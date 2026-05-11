import { Badge } from '@/components/ui/badge';
import { DataTable, DataTableColumn } from './DataTable';
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

const bandVariant = (b?: string | null) => {
  if (!b) return 'secondary' as const;
  const v = b.toLowerCase();
  if (v.includes('green') || v === 'a') return 'default' as const;
  if (v.includes('red') || v === 'c') return 'destructive' as const;
  return 'secondary' as const;
};

const DistributorTable = ({ rows, onSelect }: { rows: DistributorRow[]; onSelect: (r: DistributorRow) => void }) => {
  const columns: DataTableColumn<DistributorRow>[] = [
    {
      key: 'firm_name', header: 'Firm Name', sortable: true, sortValue: r => (r?.firm_name || '').toLowerCase(),
      accessor: r => (
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="font-medium">{r?.firm_name || 'Unnamed'}</span>
        </div>
      ),
    },
    { key: 'owner_name', header: 'Owner', accessor: r => r?.owner_name || '—', sortable: true, sortValue: r => (r?.owner_name || '').toLowerCase() },
    {
      key: 'contact_mobile', header: 'Mobile',
      accessor: r => r?.contact_mobile ? (
        <span className="inline-flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 text-muted-foreground" />{r.contact_mobile}</span>
      ) : '—',
    },
    {
      key: 'city', header: 'City',
      accessor: r => (
        <span className="inline-flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
          {[r?.city, r?.state].filter(Boolean).join(', ') || '—'}
        </span>
      ),
    },
    { key: 'se', header: 'Onboarded By', accessor: r => <span className="text-muted-foreground text-sm">{r?.profiles?.name || '—'}</span> },
    {
      key: 'band', header: 'Band / Score', className: 'text-center', headerClassName: 'font-semibold text-center',
      accessor: r => (
        <div className="flex flex-col items-center gap-0.5">
          <Badge variant={bandVariant(r?.band)}>{r?.band || 'N/A'}</Badge>
          {r?.total_score != null && <span className="text-xs text-muted-foreground">{r.total_score}</span>}
        </div>
      ),
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
      searchPlaceholder="Search distributors..."
      searchAccessor={r => `${r?.firm_name || ''} ${r?.owner_name || ''} ${r?.contact_mobile || ''} ${r?.city || ''}`}
      rowKey={r => r.id}
      onRowClick={onSelect}
      emptyMessage="No distributors found."
    />
  );
};

export default DistributorTable;
