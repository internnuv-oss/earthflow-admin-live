import { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';

const isUrl = (v: unknown): v is string =>
  typeof v === 'string' && /^https?:\/\//i.test(v);

const isImageUrl = (v: string) => /\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(v);

export const fmtKey = (k: string) =>
  k.replace(/[_-]/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/\b\w/g, c => c.toUpperCase());

export const naIfEmpty = (v: unknown): ReactNode => {
  if (v === null || v === undefined || v === '') return <span className="text-muted-foreground italic">N/A</span>;
  if (Array.isArray(v) && v.length === 0) return <span className="text-muted-foreground italic">None</span>;
  return null;
};

export const renderValue = (v: unknown): ReactNode => {
  const empty = naIfEmpty(v);
  if (empty) return empty;
  if (typeof v === 'boolean') return <Badge variant={v ? 'default' : 'secondary'}>{v ? 'Yes' : 'No'}</Badge>;
  if (typeof v === 'number') return <span className="font-mono">{v}</span>;
  if (isUrl(v as string)) {
    const url = v as string;
    if (isImageUrl(url)) {
      return (
        <a href={url} target="_blank" rel="noreferrer" className="inline-block">
          <img src={url} alt="" className="h-16 w-16 rounded-md object-cover border border-border" />
        </a>
      );
    }
    return (
      <a href={url} target="_blank" rel="noreferrer" className="text-primary underline break-all text-sm">
        Open link
      </a>
    );
  }
  if (Array.isArray(v)) {
    // primitive array → badges
    if (v.every(x => typeof x === 'string' || typeof x === 'number')) {
      return (
        <div className="flex flex-wrap gap-1.5">
          {v.map((x, i) => <Badge key={i} variant="secondary">{String(x)}</Badge>)}
        </div>
      );
    }
    return (
      <div className="space-y-2">
        {v.map((item, i) => (
          <div key={i} className="rounded-md border border-border bg-muted/30 p-3">
            <KeyValueGrid data={item as Record<string, unknown>} />
          </div>
        ))}
      </div>
    );
  }
  if (typeof v === 'object') {
    return <KeyValueGrid data={v as Record<string, unknown>} />;
  }
  return <span className="break-words text-sm">{String(v)}</span>;
};

export const KeyValueGrid = ({ data }: { data: Record<string, unknown> | null | undefined }) => {
  const entries = Object.entries(data || {});
  if (entries.length === 0) return <p className="text-sm text-muted-foreground italic">No data</p>;
  return (
    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
      {entries.map(([k, v]) => {
        const isNested = v && typeof v === 'object';
        return (
          <div key={k} className={isNested ? 'sm:col-span-2 space-y-1' : 'space-y-0.5'}>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{fmtKey(k)}</dt>
            <dd className="text-sm text-foreground">{renderValue(v)}</dd>
          </div>
        );
      })}
    </dl>
  );
};

export const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <div className="rounded-lg border border-border bg-card p-4 space-y-3">
    <h4 className="text-sm font-semibold text-foreground">{title}</h4>
    {children}
  </div>
);
