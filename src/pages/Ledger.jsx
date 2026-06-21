import { useCallback, useEffect, useState } from "react";
import PageHeader from "../components/ui/PageHeader";
import Pagination from "../components/ui/Pagination";
import LottieLoader from "../components/ui/LottieLoader";
import { ledgerApi } from "../api/client";
import { useToast } from "../context/ToastContext";

const TYPE_LABELS = {
  purchase: "Purchase",
  sale: "Sale",
  adjustment: "Adjustment",
  opening: "Opening",
};

function formatDate(value) {
  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function typeBadge(type) {
  const map = {
    purchase: "badge-success",
    sale: "badge-danger",
    adjustment: "badge-warning",
    opening: "badge-neutral",
  };
  return (
    <span className={`badge ${map[type] || "badge-neutral"}`}>
      {TYPE_LABELS[type] || type}
    </span>
  );
}

export default function Ledger() {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchItems = useCallback(() => {
    setLoading(true);
    const params = { page, limit: 10 };
    if (search) params.search = search;
    if (type) params.type = type;

    ledgerApi
      .list(params)
      .then((res) => {
        setItems(res.data.items);
        setPagination(res.data.pagination);
      })
      .catch((err) => toast.error(err.message))
      .finally(() => setLoading(false));
  }, [page, search, type, toast]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  return (
    <>
      <PageHeader
        title="Stock Ledger"
        subtitle="Track stock in, sales, and adjustments"
      />

      <div className="card">
        <div className="toolbar">
          <input
            type="text"
            placeholder="Search medicine or reference..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
          <select
            value={type}
            onChange={(e) => {
              setType(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All types</option>
            <option value="purchase">Purchase</option>
            <option value="sale">Sale</option>
            <option value="adjustment">Adjustment</option>
            <option value="opening">Opening</option>
          </select>
        </div>

        {loading ? (
          <div className="loading">
            <LottieLoader message="Loading ledger..." compact />
          </div>
        ) : items.length === 0 ? (
          <div className="empty-state">No ledger entries found</div>
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Medicine</th>
                    <th>Change</th>
                    <th>Balance</th>
                    <th>Reference</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((entry) => (
                    <tr key={entry._id}>
                      <td>{formatDate(entry.createdAt)}</td>
                      <td>{typeBadge(entry.type)}</td>
                      <td>{entry.medicineName}</td>
                      <td
                        className={
                          entry.quantityChange >= 0
                            ? "ledger-change-in"
                            : "ledger-change-out"
                        }
                      >
                        {entry.quantityChange >= 0 ? "+" : ""}
                        {entry.quantityChange}
                      </td>
                      <td>{entry.balanceAfter}</td>
                      <td>{entry.referenceLabel || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination
              pagination={pagination}
              page={page}
              onPageChange={setPage}
              itemLabel="entries"
            />
          </>
        )}
      </div>
    </>
  );
}
