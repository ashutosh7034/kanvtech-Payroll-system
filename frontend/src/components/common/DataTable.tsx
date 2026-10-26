import React, { useState, useMemo } from 'react';
import { Search, ChevronDown, ChevronUp, ChevronsUpDown, ChevronLeft, ChevronRight, Inbox } from 'lucide-react';

export interface ColumnDef<T> {
  key: string;
  header: string;
  accessor?: (item: T) => any;
  render?: (item: T, index: number) => React.ReactNode;
  align?: 'left' | 'center' | 'right';
  isCurrency?: boolean;
  sortable?: boolean;
  width?: string;
}

interface DataTableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  keyExtractor?: (item: T, index: number) => string;
  searchPlaceholder?: string;
  searchFilter?: (item: T, query: string) => boolean;
  toolbarActions?: React.ReactNode;
  pageSize?: number;
  isLoading?: boolean;
  emptyTitle?: string;
  emptySubtitle?: string;
  onRowClick?: (item: T) => void;
  className?: string;
}

export function DataTable<T extends Record<string, any>>({
  data,
  columns,
  keyExtractor,
  searchPlaceholder = 'Filter records...',
  searchFilter,
  toolbarActions,
  pageSize = 15,
  isLoading = false,
  emptyTitle = 'No records found',
  emptySubtitle = 'There are no items matching the selected filters or query.',
  onRowClick,
  className = ''
}: DataTableProps<T>) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);

  // 1. Search Filter
  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) return data;
    const q = searchQuery.toLowerCase().trim();

    return data.filter(item => {
      if (searchFilter) return searchFilter(item, q);

      // Default string match across all string/number fields
      return Object.values(item).some(val => {
        if (val === null || val === undefined) return false;
        if (typeof val === 'string' || typeof val === 'number') {
          return String(val).toLowerCase().includes(q);
        }
        return false;
      });
    });
  }, [data, searchQuery, searchFilter]);

  // 2. Sorting
  const sortedData = useMemo(() => {
    if (!sortKey) return filteredData;

    const col = columns.find(c => c.key === sortKey);
    return [...filteredData].sort((a, b) => {
      const valA = col?.accessor ? col.accessor(a) : a[sortKey];
      const valB = col?.accessor ? col.accessor(b) : b[sortKey];

      if (valA === valB) return 0;
      if (valA === null || valA === undefined) return 1;
      if (valB === null || valB === undefined) return -1;

      let comparison = 0;
      if (typeof valA === 'number' && typeof valB === 'number') {
        comparison = valA - valB;
      } else {
        comparison = String(valA).localeCompare(String(valB), undefined, { numeric: true });
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [filteredData, sortKey, sortDirection, columns]);

  // 3. Pagination
  const totalPages = Math.max(1, Math.ceil(sortedData.length / pageSize));
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, currentPage, pageSize]);

  const handleSort = (key: string, sortable?: boolean) => {
    if (!sortable) return;
    if (sortKey === key) {
      if (sortDirection === 'asc') setSortDirection('desc');
      else {
        setSortKey(null);
        setSortDirection('asc');
      }
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  return (
    <div className={`data-table-container ${className}`}>
      {/* Table Toolbar */}
      <div className="data-table-toolbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, maxWidth: '400px' }}>
          <div
            style={{
              position: 'relative',
              width: '100%',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <Search
              size={14}
              style={{
                position: 'absolute',
                left: '10px',
                color: 'var(--text-dim)',
                pointerEvents: 'none'
              }}
            />
            <input
              type="text"
              className="input-field input-sm"
              placeholder={searchPlaceholder}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              style={{
                paddingLeft: '32px',
                width: '100%',
                backgroundColor: 'var(--bg-subtle)'
              }}
            />
          </div>
          <span
            style={{
              fontSize: '0.6875rem',
              color: 'var(--text-dim)',
              whiteSpace: 'nowrap',
              fontVariantNumeric: 'tabular-nums'
            }}
          >
            {sortedData.length} {sortedData.length === 1 ? 'record' : 'records'}
          </span>
        </div>

        {toolbarActions && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {toolbarActions}
          </div>
        )}
      </div>

      {/* Table Content */}
      <div className="data-table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              {columns.map((col) => {
                const isSorted = sortKey === col.key;
                const alignClass = col.align === 'right' || col.isCurrency ? 'col-currency' : col.align === 'center' ? 'col-center' : '';

                return (
                  <th
                    key={col.key}
                    className={alignClass}
                    style={{
                      width: col.width,
                      cursor: col.sortable ? 'pointer' : 'default',
                      userSelect: 'none'
                    }}
                    onClick={() => handleSort(col.key, col.sortable)}
                  >
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        justifyContent: col.align === 'right' || col.isCurrency ? 'flex-end' : col.align === 'center' ? 'center' : 'flex-start'
                      }}
                    >
                      <span>{col.header}</span>
                      {col.sortable && (
                        <span style={{ color: isSorted ? 'var(--primary)' : 'var(--text-dim)' }}>
                          {isSorted ? (
                            sortDirection === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
                          ) : (
                            <ChevronsUpDown size={11} />
                          )}
                        </span>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={columns.length} style={{ textAlign: 'center', padding: '36px 12px' }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)' }}>
                    <div className="spinner" style={{ width: '16px', height: '16px' }} />
                    <span>Loading data records...</span>
                  </div>
                </td>
              </tr>
            ) : paginatedData.length === 0 ? (
              <tr>
                <td colSpan={columns.length} style={{ textAlign: 'center', padding: '40px 16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                    <div
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--bg-subtle)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--text-dim)'
                      }}
                    >
                      <Inbox size={18} />
                    </div>
                    <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-main)' }}>
                      {emptyTitle}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', maxWidth: '300px' }}>
                      {emptySubtitle}
                    </div>
                  </div>
                </td>
              </tr>
            ) : (
              paginatedData.map((item, idx) => {
                const key = keyExtractor ? keyExtractor(item, idx) : item.id || idx;
                return (
                  <tr
                    key={key}
                    onClick={() => onRowClick && onRowClick(item)}
                    style={{ cursor: onRowClick ? 'pointer' : 'default' }}
                  >
                    {columns.map((col) => {
                      const alignClass = col.align === 'right' || col.isCurrency ? 'col-currency' : col.align === 'center' ? 'col-center' : '';
                      return (
                        <td key={col.key} className={alignClass}>
                          {col.render
                            ? col.render(item, idx)
                            : col.accessor
                            ? col.accessor(item)
                            : item[col.key] ?? '—'}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {!isLoading && sortedData.length > pageSize && (
        <div
          style={{
            padding: '8px 14px',
            borderTop: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.75rem',
            color: 'var(--text-muted)',
            backgroundColor: 'var(--bg-surface)'
          }}
        >
          <div>
            Showing <strong style={{ color: 'var(--text-main)' }}>{(currentPage - 1) * pageSize + 1}</strong> to{' '}
            <strong style={{ color: 'var(--text-main)' }}>{Math.min(currentPage * pageSize, sortedData.length)}</strong> of{' '}
            <strong style={{ color: 'var(--text-main)' }}>{sortedData.length}</strong> records
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <button
              className="btn btn-outline btn-sm"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              style={{ padding: '0 6px', height: '24px' }}
            >
              <ChevronLeft size={13} />
            </button>
            <span style={{ padding: '0 8px', fontVariantNumeric: 'tabular-nums' }}>
              Page {currentPage} of {totalPages}
            </span>
            <button
              className="btn btn-outline btn-sm"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              style={{ padding: '0 6px', height: '24px' }}
            >
              <ChevronRight size={13} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
