import { EmptyState } from "../ui/EmptyState.jsx";
import { LoadingState } from "../ui/LoadingState.jsx";

function getRowKey(row, index, rowKey) {
  if (typeof rowKey === "function") return rowKey(row, index);
  if (typeof rowKey === "string") return row?.[rowKey];
  return row?.id ?? index;
}

function getCellValue(row, column, rowIndex) {
  const value = typeof column.accessor === "function"
    ? column.accessor(row, rowIndex)
    : row?.[column.key];
  return column.render ? column.render(value, row, rowIndex) : value;
}

export function DataTable({
  columns = [],
  rows = [],
  loading = false,
  loadingMessage = "Loading data...",
  emptyTitle = "No records found",
  emptyMessage,
  rowKey,
  caption,
}) {
  if (loading) return <LoadingState message={loadingMessage} />;
  if (!rows.length) return <EmptyState title={emptyTitle} message={emptyMessage} />;

  return (
    <div className="data-table__scroll">
      <table className="data-table">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col" className={column.className}>{column.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={getRowKey(row, rowIndex, rowKey)}>
              {columns.map((column) => (
                <td key={column.key} className={column.className}>
                  {getCellValue(row, column, rowIndex)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
