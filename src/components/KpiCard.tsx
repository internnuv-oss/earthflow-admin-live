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
        'border-border shadow-sm h-full',
        to && 'transition-all hover:shadow-md hover:border-primary/40 cursor-pointer',
      )}
    >
      <CardContent className="flex items-center gap-4 p-6">
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg ${iconBg[accent]}`}>
          <Icon className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold tracking-tight">{value}</p>
          {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
        </div>
      </CardContent>
    </Card>
  );

  if (to) {
    return (
      <Link to={to} className="block focus:outline-none focus:ring-2 focus:ring-primary/40 rounded-lg">
        {card}
      </Link>
    );
  }
  return card;
};

export default KpiCard;
