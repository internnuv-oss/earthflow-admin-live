import { useState, useMemo, ReactNode, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
// Added X icon for the reset button
import { Search, ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, PlusCircle, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface DataTableColumn<T> {
  key: string;
  header: string;
  accessor: (row: T) => ReactNode;
  sortValue?: (row: T) => string | number;
  sortable?: boolean;
  className?: string;
  headerClassName?: string;
}

export interface DataTableFilter<T> {
  key: string;
  label: string;
  options: { value: string; label: string }[];
  predicate: (row: T, selectedValues: string[]) => boolean; 
  width?: string;
}

interface DataTableProps<T> {
  data: T[];
  columns: DataTableColumn<T>[];
  filters?: DataTableFilter<T>[];
  searchPlaceholder?: string;
  searchAccessor: (row: T) => string;
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  pageSize?: number;
  emptyMessage?: string;
  onFilteredDataChange?: (filteredData: T[]) => void; 
}

export function DataTable<T>({
  data,
  columns,
  filters = [],
  searchPlaceholder = 'Search...',
  searchAccessor,
  rowKey,
  onRowClick,
  pageSize = 10,
  emptyMessage = 'No records found.',
  onFilteredDataChange,
}: DataTableProps<T>) {
  const [search, setSearch] = useState('');
  const [filterValues, setFilterValues] = useState<Record<string, string[]>>({});
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);

  // Check if any filters or search are currently active
  const hasActiveFilters = search.trim().length > 0 || Object.values(filterValues).some(arr => arr && arr.length > 0);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data || []).filter(row => {
      const rowValue = searchAccessor(row) || '';
      if (q && !String(rowValue).toLowerCase().includes(q)) return false;
      
      for (const f of filters) {
        const selected = filterValues[f.key] || [];
        if (selected.length > 0 && !f.predicate(row, selected)) return false;
      }
      return true;
    });
  }, [data, search, filterValues, filters, searchAccessor]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    const col = columns.find(c => c.key === sortKey);
    if (!col?.sortValue) return filtered;
    const arr = [...filtered];
    arr.sort((a, b) => {
      const av = col.sortValue!(a);
      const bv = col.sortValue!(b);
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return arr;
  }, [filtered, sortKey, sortDir, columns]);

  useEffect(() => {
    if (onFilteredDataChange) {
      onFilteredDataChange(sorted);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sorted]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paged = useMemo(
    () => sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [sorted, currentPage, pageSize],
  );

  const toggleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
    setPage(1);
  };

  const updateFilter = (key: string, values: string[]) => {
    setFilterValues(prev => ({ ...prev, [key]: values }));
    setPage(1);
  };

  const resetAllFilters = () => {
    setSearch('');
    setFilterValues({});
    setPage(1);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex flex-wrap gap-3 w-full flex-1 items-center">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={searchPlaceholder}
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              className="pl-9 h-9"
            />
          </div>
          
          {filters.map(f => {
            const selectedValues = new Set(filterValues[f.key] || []);
            return (
              <Popover key={f.key}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 border-dashed text-sm font-medium">
                    <PlusCircle className="mr-2 h-4 w-4" />
                    {f.label}
                    {selectedValues.size > 0 && (
                      <>
                        <div className="mx-2 h-4 w-[1px] bg-border" />
                        <Badge variant="secondary" className="rounded-sm px-1 font-normal lg:hidden">
                          {selectedValues.size}
                        </Badge>
                        <div className="hidden space-x-1 lg:flex">
                          {selectedValues.size > 2 ? (
                            <Badge variant="secondary" className="rounded-sm px-1 font-normal">
                              {selectedValues.size} selected
                            </Badge>
                          ) : (
                            f.options
                              .filter((opt) => selectedValues.has(opt.value))
                              .map((opt) => (
                                <Badge variant="secondary" key={opt.value} className="rounded-sm px-1 font-normal">
                                  {opt.label}
                                </Badge>
                              ))
                          )}
                        </div>
                      </>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[220px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder={`Search ${f.label}...`} />
                    <CommandList>
                      <CommandEmpty>No results found.</CommandEmpty>
                      <CommandGroup>
                        {f.options.map((opt) => {
                          const isSelected = selectedValues.has(opt.value);
                          return (
                            <CommandItem
                              key={opt.value}
                              onSelect={() => {
                                const next = new Set(selectedValues);
                                if (isSelected) { next.delete(opt.value); } 
                                else { next.add(opt.value); }
                                updateFilter(f.key, Array.from(next));
                              }}
                            >
                              <div
                                className={cn(
                                  "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                                  isSelected ? "bg-primary text-primary-foreground" : "opacity-50 [&_svg]:invisible"
                                )}
                              >
                                <Check className="h-4 w-4" />
                              </div>
                              <span className="truncate">{opt.label}</span>
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                      {selectedValues.size > 0 && (
                        <>
                          <CommandSeparator />
                          <CommandGroup>
                            <CommandItem
                              onSelect={() => updateFilter(f.key, [])}
                              className="justify-center text-center font-medium"
                            >
                              Clear filters
                            </CommandItem>
                          </CommandGroup>
                        </>
                      )}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            );
          })}

          {/* NEW RESET BUTTON */}
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={resetAllFilters}
              className="h-9 px-2 text-muted-foreground hover:text-foreground"
            >
              <X className="mr-2 h-4 w-4" />
              Reset Filters
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <div className="w-full overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                {columns.map(col => (
                  <TableHead key={col.key} className={col.headerClassName ?? 'font-semibold whitespace-nowrap'}>
                    {col.sortable && col.sortValue ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(col.key)}
                        className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
                      >
                        {col.header}
                        {sortKey === col.key ? (
                          sortDir === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />
                        ) : (
                          <ArrowUpDown className="h-3.5 w-3.5 opacity-50" />
                        )}
                      </button>
                    ) : (
                      col.header
                    )}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="text-center py-10 text-muted-foreground">
                    {emptyMessage}
                  </TableCell>
                </TableRow>
              ) : (
                paged.map(row => (
                  <TableRow
                    key={rowKey(row)}
                    className={onRowClick ? 'cursor-pointer hover:bg-accent/50 transition-colors' : ''}
                    onClick={() => onRowClick?.(row)}
                  >
                    {columns.map(col => (
                      <TableCell key={col.key} className={col.className}>
                        {col.accessor(row)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Showing {paged.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}–
          {(currentPage - 1) * pageSize + paged.length} of {sorted.length}
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
            <ChevronLeft className="h-4 w-4" /> Prev
          </Button>
          <span className="text-xs text-muted-foreground px-2">
            Page {currentPage} of {totalPages}
          </span>
          <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
            Next <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export default DataTable;