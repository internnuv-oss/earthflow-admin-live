import { Badge } from '@/components/ui/badge';
import { DataTable, DataTableColumn } from './DataTable';
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

const FarmerTable = ({ rows, onSelect }: { rows: FarmerRow[]; onSelect: (r: FarmerRow) => void }) => {
  const columns: DataTableColumn<FarmerRow>[] = [
    {
      key: 'full_name', header: 'Full Name', sortable: true,
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
      accessor: r => r?.mobile ? (
        <span className="inline-flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 text-muted-foreground" />{r.mobile}</span>
      ) : '—',
    },
    {
      key: 'village', header: 'Village',
      accessor: r => (
        <span className="inline-flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
          {r?.village || '—'}
        </span>
      ),
    },
    { key: 'se', header: 'Onboarded By', accessor: r => <span className="text-muted-foreground text-sm">{r?.profiles?.name || '—'}</span> },
    {
      key: 'status', header: 'Status', className: 'text-center', headerClassName: 'font-semibold text-center',
      accessor: r => <Badge variant={r?.status === 'VERIFIED' ? 'default' : 'secondary'}>{r?.status || 'DRAFT'}</Badge>,
    },
  ];

  return (
    <DataTable
      data={rows || []}
      columns={columns}
      searchPlaceholder="Search farmers..."
      searchAccessor={r => `${r?.full_name || ''} ${r?.mobile || ''} ${r?.village || ''}`}
      rowKey={r => r.id}
      onRowClick={onSelect}
      emptyMessage="No farmers found."
    />
  );
};

export default FarmerTable;
