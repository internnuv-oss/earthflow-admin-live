import { Card, CardContent } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface KpiCardProps {
  title: string;
  value: number | string;
  icon: LucideIcon;
  description?: string;
  accent?: 'primary' | 'destructive' | 'muted';
  to?: string;
}

const KpiCard = ({ title, value, icon: Icon, description, accent = 'primary', to }: KpiCardProps) => {
  const iconBg = {
    primary: 'bg-primary/10 text-primary',
    destructive: 'bg-destructive/10 text-destructive',
    muted: 'bg-muted text-muted-foreground',
  };

  const card = (
    <Card
      className={cn(
        'border-border shadow-sm h-full flex flex-col justify-center overflow-hidden',
        to && 'transition-all hover:shadow-md hover:border-primary/40 cursor-pointer',
      )}
    >
      <CardContent className="flex items-center gap-4 p-5">
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg ${iconBg[accent]}`}>
          <Icon className="h-6 w-6" />
        </div>
        
        {/* 🚀 RESPONSIVE FIX: flex-1, min-w-0, and truncate to gracefully handle long texts */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-muted-foreground truncate" title={title}>{title}</p>
          <p className="text-2xl font-bold tracking-tight truncate my-0.5" title={String(value)}>{value}</p>
          {description && (
            <p className="text-xs text-muted-foreground line-clamp-2 leading-snug" title={description}>
              {description}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );

  if (to) {
    return (
      <Link to={to} className="block h-full focus:outline-none focus:ring-2 focus:ring-primary/40 rounded-lg">
        {card}
      </Link>
    );
  }
  return card;
};

export default KpiCard;