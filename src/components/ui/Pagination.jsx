function getVisiblePages(current, total) {
  if (total <= 1) return [1];
  if (total <= 5) {
    return Array.from({ length: total }, (_, index) => index + 1);
  }

  const pages = [1];
  let start = Math.max(2, current - 1);
  let end = Math.min(total - 1, current + 1);

  if (current <= 3) {
    start = 2;
    end = 4;
  } else if (current >= total - 2) {
    start = total - 3;
    end = total - 1;
  }

  if (start > 2) pages.push("ellipsis-start");
  for (let page = start; page <= end; page += 1) pages.push(page);
  if (end < total - 1) pages.push("ellipsis-end");
  pages.push(total);

  return pages;
}

export default function Pagination({
  pagination,
  page,
  onPageChange,
  itemLabel = "items",
}) {
  if (!pagination || pagination.totalItems === 0) return null;

  const { totalPages, totalItems, itemsPerPage } = pagination;
  const start = (page - 1) * itemsPerPage + 1;
  const end = Math.min(page * itemsPerPage, totalItems);
  const pages = getVisiblePages(page, totalPages);

  return (
    <div className="pagination">
      <span className="pagination-summary">
        Showing {start}–{end} of {totalItems} {itemLabel}
      </span>

      <div className="pagination-controls">
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </button>

        <div className="pagination-pages">
          {pages.map((pageNumber) => {
            if (typeof pageNumber === "string") {
              return (
                <span key={pageNumber} className="pagination-ellipsis">
                  …
                </span>
              );
            }

            return (
              <button
                key={pageNumber}
                type="button"
                className={`pagination-page${
                  pageNumber === page ? " is-active" : ""
                }`}
                onClick={() => onPageChange(pageNumber)}
                aria-current={pageNumber === page ? "page" : undefined}
              >
                {pageNumber}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
