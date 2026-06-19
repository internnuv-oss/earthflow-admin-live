import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { DataTable, DataTableColumn } from './DataTable';
import { Button } from '@/components/ui/button'; // 🚀 Added Button import
import { Mail, Phone, User, Edit2, Eye } from 'lucide-react'; // 🚀 Added Edit2 & Eye icons

export interface SERow {
  id: string;
  name: string;
  mobile: string | null;
  email: string | null;
  role: string;
  created_at: string;
  sales_executive?: {
    is_profile_complete?: boolean;
    personal_details?: any;
    organization_details?: any;
    financial_details?: any;
    assets_details?: any;
    documents?: any;
  } | null;
}

interface Props {
  rows: SERow[];
  onSelect: (row: SERow) => void;
  canEdit: boolean; // 🚀 Added dynamic edit permission prop
}

const SETable = ({ rows, onSelect, canEdit }: Props) => {
  // Wrap columns in useMemo so it correctly re-renders when the canEdit permission status changes
  const columns: DataTableColumn<SERow>[] = useMemo(() => [
    {
      key: 'name', header: 'Name', sortable: true, sortValue: r => (r?.name || '').toLowerCase(),
      accessor: r => (
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-primary">
            <User className="h-4 w-4" />
          </div>
          <span className="font-medium">{r?.name || 'Unnamed'}</span>
        </div>
      ),
    },
    {
      key: 'mobile', header: 'Mobile',
      accessor: r => r?.mobile ? (
        <span className="inline-flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 text-muted-foreground" />{r.mobile}</span>
      ) : <span className="text-muted-foreground">—</span>,
    },
    {
      key: 'email', header: 'Email',
      accessor: r => r?.email ? (
        <span className="inline-flex items-center gap-1.5"><Mail className="h-3.5 w-3.5 text-muted-foreground" />{r.email}</span>
      ) : <span className="text-muted-foreground">—</span>,
    },
    {
      key: 'complete', header: 'Profile Status', className: 'text-center', headerClassName: 'font-semibold text-center',
      accessor: r => {
        const done = !!r?.sales_executive?.is_profile_complete;
        return <Badge variant={done ? 'default' : 'secondary'}>{done ? 'Complete' : 'Pending'}</Badge>;
      },
      sortable: true, sortValue: r => (r?.sales_executive?.is_profile_complete ? 1 : 0),
    },
    {
      key: 'created_at', header: 'Joined', sortable: true,
      sortValue: r => r?.created_at ? new Date(r.created_at).getTime() : 0,
      accessor: r => <span className="text-xs text-muted-foreground">{r?.created_at ? new Date(r.created_at).toLocaleDateString() : '—'}</span>,
    },
    {
      key: 'actions', header: 'Actions', className: 'text-right', headerClassName: 'font-semibold text-right pr-4',
      accessor: r => canEdit ? (
        <Button variant="ghost" size="sm" className="gap-1 text-primary" onClick={(e) => { e.stopPropagation(); onSelect(r); }}>
          <Edit2 className="h-3.5 w-3.5" /> Edit
        </Button>
      ) : (
        <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground" onClick={(e) => { e.stopPropagation(); onSelect(r); }}>
          <Eye className="h-3.5 w-3.5" /> View
        </Button>
      )
    }
  ], [canEdit, onSelect]);

  return (
    <DataTable
      data={rows || []}
      columns={columns}
      searchPlaceholder="Search by name, mobile, email..."
      searchAccessor={r => `${r?.name || ''} ${r?.mobile || ''} ${r?.email || ''}`}
      rowKey={r => r.id}
      onRowClick={onSelect}
      emptyMessage="No Sales Executives yet."
    />
  );
};

export default SETable;