
"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import {
  ArrowLeft,
  RefreshCw,
  CalendarDays,
  Search,
  Wallet,
  Receipt,
  Package,
  BadgePercent,
  ChevronRight,
  X,
  Printer,
  Clock3,
  CreditCard,
  CheckCircle2,
  LoaderCircle,
  FileText,
  TrendingUp,
} from "lucide-react";

type Sale = {
  id: string;
  receipt_number: string;
  cashier_id: string;
  subtotal: number;
  discount: number;
  total: number;
  payment_method: string;
  amount_paid: number;
  change_amount: number;
  status: string;
  created_at: string;
};

type SaleItem = {
  id: string;
  sale_id: string;
  product_id: string;
  product_name_snapshot: string;
  brand_snapshot: string;
  quantity: number;
  purchase_cost_snapshot: number;
  selling_price_snapshot: number;
  line_total: number;
  gross_profit_snapshot: number;
};

type Profile = {
  id: string;
  full_name: string;
};

const rupiah = (n: number) =>
  `Rp${Number(n || 0).toLocaleString("id-ID")}`;

function localDate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function paymentLabel(method: string) {
  const labels: Record<string, string> = {
    cash: "Tunai",
    qris: "QRIS",
    transfer: "Transfer",
    other: "Lainnya",
  };
  return labels[method] || method;
}

function dateLabel(value: string) {
  return new Date(value).toLocaleString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function RiwayatPenjualanPage() {
  const [supabase] = useState(() => createClient());

  const [sales, setSales] = useState<Sale[]>([]);
  const [items, setItems] = useState<SaleItem[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [detailItems, setDetailItems] = useState<SaleItem[]>([]);

  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState(() => localDate(new Date()));
  const [dateTo, setDateTo] = useState(() => localDate(new Date()));

  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const loadSales = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.replace("/login");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role,is_active")
        .eq("id", user.id)
        .maybeSingle();

     
      if (
  profileError ||
  !profile?.is_active ||
  !["owner", "admin", "cashier"].includes(
    String(profile?.role || "").toLowerCase()
  )
) {
  setError("Kamu tidak memiliki akses riwayat penjualan.");
  setSales([]);
  setItems([]);
  setProfiles([]);
  return;
}

      if (!dateFrom || !dateTo) {
        setError("Tanggal awal dan akhir harus diisi.");
        return;
      }

      if (dateFrom > dateTo) {
        setError("Tanggal awal tidak boleh melebihi tanggal akhir.");
        setSales([]);
        setItems([]);
        return;
      }

      const start = new Date(`${dateFrom}T00:00:00`);
      const end = new Date(`${dateTo}T00:00:00`);
      end.setDate(end.getDate() + 1);

      let query = supabase
        .from("sales")
        .select(`
          id, receipt_number, cashier_id, subtotal, discount,
          total, payment_method, amount_paid, change_amount,
          status, created_at
        `)
        .gte("created_at", start.toISOString())
        .lt("created_at", end.toISOString())
        .order("created_at", { ascending: false });

      if (search.trim()) {
        query = query.ilike(
          "receipt_number",
          `%${search.trim()}%`
        );
      }

      const { data, error: salesError } = await query;
      if (salesError) throw salesError;

      const saleData = (data || []) as Sale[];
      setSales(saleData);

      const saleIds = saleData.map((sale) => sale.id);

      if (!saleIds.length) {
        setItems([]);
        setProfiles([]);
        return;
      }

      const { data: itemData, error: itemError } = await supabase
        .from("sale_items")
        .select(`
          id, sale_id, product_id, product_name_snapshot,
          brand_snapshot, quantity, purchase_cost_snapshot,
          selling_price_snapshot, line_total, gross_profit_snapshot
        `)
        .in("sale_id", saleIds);

      if (itemError) throw itemError;
      setItems((itemData || []) as SaleItem[]);

      const cashierIds = [
        ...new Set(saleData.map((sale) => sale.cashier_id)),
      ].filter(Boolean);

      if (cashierIds.length) {
        const { data: cashierData, error: cashierError } = await supabase
          .from("profiles")
          .select("id,full_name")
          .in("id", cashierIds);

        if (cashierError) throw cashierError;
        setProfiles((cashierData || []) as Profile[]);
      } else {
        setProfiles([]);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Gagal memuat riwayat penjualan."
      );
    } finally {
      setLoading(false);
    }
  }, [supabase, dateFrom, dateTo, search, refreshKey]);

  useEffect(() => {
    void loadSales();
  }, [loadSales]);

  const totalOmzet = sales.reduce(
    (sum, sale) => sum + Number(sale.total || 0),
    0
  );

  const totalDiskon = sales.reduce(
    (sum, sale) => sum + Number(sale.discount || 0),
    0
  );

  const totalBarang = items.reduce(
    (sum, item) => sum + Number(item.quantity || 0),
    0
  );

  const totalProfit = items.reduce(
    (sum, item) => sum + Number(item.gross_profit_snapshot || 0),
    0
  );

  const cashierName = (id: string) =>
    profiles.find((p) => p.id === id)?.full_name || "Kasir";

  async function openDetail(sale: Sale) {
    setSelectedSale(sale);
    setDetailLoading(true);
    setDetailItems([]);

    const { data, error } = await supabase
      .from("sale_items")
      .select(`
        id, sale_id, product_id, product_name_snapshot,
        brand_snapshot, quantity, purchase_cost_snapshot,
        selling_price_snapshot, line_total, gross_profit_snapshot
      `)
      .eq("sale_id", sale.id);

    if (error) {
      setError(error.message);
    } else {
      setDetailItems((data || []) as SaleItem[]);
    }

    setDetailLoading(false);
  }

  function closeDetail() {
    setSelectedSale(null);
    setDetailItems([]);
  }

  return (
    <main className="history-page">
      <div className="history-container">
    

        <header className="history-header">
          <div>
            <div className="history-eyebrow">
              <span className="history-eyebrow-dot" />
              TOKO ROSYIDAH · SEBAUNG
            </div>
            <h1>Riwayat Penjualan</h1>
            <p>
              Pantau transaksi, omzet, dan aktivitas penjualan toko
              dalam satu halaman.
            </p>
          </div>

          <button
            type="button"
            className="history-refresh"
            onClick={() => setRefreshKey((v) => v + 1)}
            disabled={loading}
          >
            <RefreshCw
              size={16}
              className={loading ? "history-spin" : ""}
            />
            {loading ? "Memuat..." : "Muat ulang"}
          </button>
        </header>

        {error && (
          <div className="history-alert history-alert-error" role="alert">
            <span><X size={17} /></span>
            <p>{error}</p>
          </div>
        )}

        <section className="history-overview">
          <div className="history-overview-copy">
            <div className="history-overview-icon">
              <TrendingUp size={21} />
            </div>
            <div>
              <span>Ringkasan periode terpilih</span>
              <strong>{sales.length.toLocaleString("id-ID")} transaksi</strong>
              <small>
                {dateFrom === dateTo
                  ? new Date(`${dateFrom}T00:00:00`).toLocaleDateString(
                      "id-ID",
                      { day: "numeric", month: "long", year: "numeric" }
                    )
                  : `${dateFrom} — ${dateTo}`}
              </small>
            </div>
          </div>
          <div className="history-overview-total">
            <span>Total omzet</span>
            <strong>{rupiah(totalOmzet)}</strong>
          </div>
        </section>

        <section className="history-stat-grid">
          <article className="history-stat-card">
            <div className="history-stat-top">
              <span>Total omzet</span>
              <span className="history-stat-icon green"><Wallet size={19} /></span>
            </div>
            <strong>{rupiah(totalOmzet)}</strong>
            <small>Pendapatan setelah diskon</small>
          </article>

          <article className="history-stat-card">
            <div className="history-stat-top">
              <span>Jumlah transaksi</span>
              <span className="history-stat-icon gold"><Receipt size={19} /></span>
            </div>
            <strong>{sales.length.toLocaleString("id-ID")}</strong>
            <small>Transaksi penjualan</small>
          </article>

          <article className="history-stat-card">
            <div className="history-stat-top">
              <span>Barang terjual</span>
              <span className="history-stat-icon blue"><Package size={19} /></span>
            </div>
            <strong>{totalBarang.toLocaleString("id-ID")}</strong>
            <small>Total unit barang</small>
          </article>

          <article className="history-stat-card">
            <div className="history-stat-top">
              <span>Total diskon</span>
              <span className="history-stat-icon rose"><BadgePercent size={19} /></span>
            </div>
            <strong>{rupiah(totalDiskon)}</strong>
            <small>Diskon seluruh transaksi</small>
          </article>
        </section>

        <section className="history-filter-card">
          <div className="history-section-title">
            <div className="history-title-icon"><CalendarDays size={19} /></div>
            <div>
              <h2>Filter Penjualan</h2>
              <p>Tentukan periode dan cari nomor struk tertentu.</p>
            </div>
          </div>

          <div className="history-filter-grid">
            <label className="history-field">
              <span>Tanggal awal</span>
              <div className="history-input-wrap">
                <CalendarDays size={17} />
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>
            </label>

            <label className="history-field">
              <span>Tanggal akhir</span>
              <div className="history-input-wrap">
                <CalendarDays size={17} />
                <input
                  type="date"
                  value={dateTo}
                  min={dateFrom}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>
            </label>

            <label className="history-field history-search-field">
              <span>Cari nomor struk</span>
              <div className="history-input-wrap">
                <Search size={17} />
                <input
                  type="search"
                  placeholder="Contoh: TR-20261030..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </label>
          </div>
        </section>

        <section className="history-table-card">
          <div className="history-table-heading">
            <div className="history-section-title">
              <div className="history-title-icon"><FileText size={19} /></div>
              <div>
                <h2>Daftar Transaksi</h2>
                <p>Pilih transaksi untuk melihat rincian penjualan.</p>
              </div>
            </div>
            <span className="history-data-count">
              {sales.length} data
            </span>
          </div>

          {loading ? (
            <div className="history-empty">
              <LoaderCircle size={28} className="history-spin" />
              <p>Memuat data penjualan...</p>
            </div>
          ) : sales.length === 0 ? (
            <div className="history-empty">
              <div className="history-empty-icon"><Receipt size={27} /></div>
              <h3>Belum ada transaksi</h3>
              <p>Tidak ditemukan penjualan pada periode atau pencarian ini.</p>
            </div>
          ) : (
            <div className="history-table-scroll">
              <table className="history-table">
                <thead>
                  <tr>
                    <th>No.</th>
                    <th>Nomor struk</th>
                    <th>Tanggal transaksi</th>
                    <th>Kasir</th>
                    <th>Pembayaran</th>
                    <th className="align-right">Diskon</th>
                    <th className="align-right">Total</th>
                    <th className="align-center">Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.map((sale, index) => (
                    <tr key={sale.id}>
                      <td className="history-row-number">
                        {String(index + 1).padStart(2, "0")}
                      </td>
                      <td>
                        <strong className="history-receipt-number">
                          {sale.receipt_number}
                        </strong>
                      </td>
                      <td>
                        <span className="history-date">
                          <Clock3 size={14} />
                          {dateLabel(sale.created_at)}
                        </span>
                      </td>
                      <td>{cashierName(sale.cashier_id)}</td>
                      <td>
                        <span className="history-payment">
                          <CreditCard size={13} />
                          {paymentLabel(sale.payment_method)}
                        </span>
                      </td>
                      <td className="align-right history-money-muted">
                        {rupiah(sale.discount)}
                      </td>
                      <td className="align-right">
                        <strong className="history-total">
                          {rupiah(sale.total)}
                        </strong>
                      </td>
                      <td className="align-center">
                        <button
                          type="button"
                          className="history-detail-button"
                          onClick={() => void openDetail(sale)}
                        >
                          Detail <ChevronRight size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={6}>TOTAL OMZET</td>
                    <td className="align-right">{rupiah(totalOmzet)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </section>

        <footer className="history-footer">
          <span>TOKO ROSYIDAH</span>
          <i />
          Sistem Manajemen Penjualan
        </footer>
      </div>

      {selectedSale && (
        <div className="history-modal-backdrop" onClick={closeDetail}>
          <section
            className="history-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Detail penjualan"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="history-modal-header">
              <div>
                <span className="history-modal-eyebrow">RINCIAN TRANSAKSI</span>
                <h2>Detail Penjualan</h2>
                <p>{selectedSale.receipt_number}</p>
              </div>
              <button
                type="button"
                className="history-modal-close"
                onClick={closeDetail}
                aria-label="Tutup detail"
              >
                <X size={20} />
              </button>
            </header>

            <div className="history-modal-body" id="sale-detail-print">
              <div className="history-receipt-brand">
                <div className="history-receipt-logo">R</div>
                <h2>TOKO ROSYIDAH</h2>
                <p>Sebaung</p>
                <span>{selectedSale.receipt_number}</span>
                <small>{dateLabel(selectedSale.created_at)}</small>
              </div>

              <div className="history-receipt-meta">
                <div><span>Kasir</span><strong>{cashierName(selectedSale.cashier_id)}</strong></div>
                <div><span>Pembayaran</span><strong>{paymentLabel(selectedSale.payment_method)}</strong></div>
              </div>

              <div className="history-receipt-items">
                {detailLoading ? (
                  <div className="history-detail-loading">
                    <LoaderCircle size={22} className="history-spin" />
                    Memuat detail barang...
                  </div>
                ) : detailItems.length === 0 ? (
                  <p className="history-no-items">Detail barang tidak ditemukan.</p>
                ) : (
                  detailItems.map((item) => (
                    <article key={item.id} className="history-receipt-item">
                      <div>
                        <strong>{item.product_name_snapshot}</strong>
                        <small>{item.brand_snapshot}</small>
                      </div>
                      <div className="history-receipt-line">
                        <span>
                          {item.quantity} × {rupiah(item.selling_price_snapshot)}
                        </span>
                        <strong>{rupiah(item.line_total)}</strong>
                      </div>
                    </article>
                  ))
                )}
              </div>

              <div className="history-receipt-totals">
                <div><span>Subtotal</span><strong>{rupiah(selectedSale.subtotal)}</strong></div>
                <div><span>Diskon</span><strong>{rupiah(selectedSale.discount)}</strong></div>
                <div className="receipt-grand-total"><span>Total</span><strong>{rupiah(selectedSale.total)}</strong></div>
                <div><span>Dibayar</span><strong>{rupiah(selectedSale.amount_paid)}</strong></div>
                <div><span>Kembalian</span><strong>{rupiah(selectedSale.change_amount)}</strong></div>
              </div>

              <p className="history-receipt-thanks">
                Terima kasih telah berbelanja!
              </p>
            </div>

            <footer className="history-modal-actions">
              <button
                type="button"
                className="history-print-button"
                onClick={() => window.print()}
                disabled={detailLoading || detailItems.length === 0}
              >
                <Printer size={17} />
                Cetak ulang struk
              </button>
              <button
                type="button"
                className="history-close-button"
                onClick={closeDetail}
              >
                Tutup
              </button>
            </footer>
          </section>
        </div>
      )}

     
<style jsx global>{`
  .history-page {
  --emerald: #174b36;
  --emerald-dark: #103a2a;
  --emerald-soft: #edf4ef;
  --gold: #b99a62;
  --ivory: #f8f8f4;
  --ink: #26352c;
  --muted: #849087;
  --line: #e8ece6;

  width: 100%;
  max-width: none;
  min-height: 100%;
  margin: 0;
  padding: 0 0 36px;
  display: flex;
  flex-direction: column;
  gap: 22px;
  color: var(--ink);
  font-family: var(--font-dm-sans), sans-serif;
}

.history-container {
  width: 100%;
  max-width: none;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 22px;
}

  .history-back {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 20px;
    padding: 10px 14px;
    border: 1px solid #dce8de;
    border-radius: 9px;
    background: #fff;
    color: var(--emerald);
    font-size: 11px;
    font-weight: 800;
    text-decoration: none;
    transition: .2s ease;
  }

  .history-back:hover {
    background: var(--emerald-soft);
    transform: translateX(-2px);
  }

  /* HEADER */

  .history-header {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
    overflow: hidden;
    margin-bottom: 22px;
    padding: 30px 32px;
    border: 1px solid #e5e9e1;
    border-radius: 22px;
    background:
      radial-gradient(circle at 92% 10%, rgba(185,154,98,.13), transparent 28%),
      linear-gradient(115deg, #ffffff 0%, #f5f8f3 100%);
    box-shadow: 0 8px 28px rgba(24,55,37,.035);
  }

  .history-header::after {
    content: "";
    position: absolute;
    width: 180px;
    height: 180px;
    right: 90px;
    bottom: -125px;
    border: 1px solid rgba(185,154,98,.24);
    border-radius: 50%;
    pointer-events: none;
  }

  .history-eyebrow {
    display: flex;
    align-items: center;
    gap: 9px;
    margin-bottom: 10px;
    color: var(--gold);
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 2.4px;
  }

  .history-eyebrow-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--gold);
  }

  .history-header h1 {
    margin: 0;
    color: var(--emerald-dark);
    font-family: var(--font-manrope), sans-serif;
    font-size: clamp(27px, 3vw, 35px);
    font-weight: 800;
    letter-spacing: -1.4px;
  }

  .history-header p {
    margin: 9px 0 0;
    color: #7b877e;
    font-size: 13px;
    line-height: 1.7;
  }

  .history-refresh {
    position: relative;
    z-index: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 9px;
    min-height: 42px;
    padding: 0 16px;
    border: 1px solid #dce7dd;
    border-radius: 10px;
    background: #fff;
    color: var(--emerald);
    font-family: inherit;
    font-size: 11px;
    font-weight: 800;
    cursor: pointer;
    transition: .2s ease;
    white-space: nowrap;
  }

  .history-refresh:hover:not(:disabled) {
    background: var(--emerald-soft);
    border-color: #bfd2c2;
  }

  .history-refresh:disabled {
    opacity: .55;
    cursor: not-allowed;
  }

  /* ALERT */

  .history-alert {
    display: flex;
    align-items: flex-start;
    gap: 11px;
    margin-bottom: 18px;
    padding: 14px 17px;
    border-radius: 11px;
    font-size: 11px;
    line-height: 1.7;
  }

  .history-alert p {
    margin: 0;
    overflow-wrap: anywhere;
  }

  .history-alert-error {
    border: 1px solid #f0d9d5;
    background: #fff5f3;
    color: #a64d45;
  }

  /* OVERVIEW */

  .history-overview {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
    margin-bottom: 16px;
    padding: 20px 23px;
    border: 1px solid var(--line);
    border-radius: 16px;
    background: #fff;
    box-shadow: 0 5px 18px rgba(24,55,37,.035);
  }

  .history-overview-copy {
    display: flex;
    align-items: center;
    gap: 14px;
  }

  .history-overview-icon {
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    flex-shrink: 0;
    border-radius: 12px;
    background: var(--emerald-soft);
    color: var(--emerald);
  }

  .history-overview-copy > div:last-child {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .history-overview-copy span,
  .history-overview-total span {
    color: var(--muted);
    font-size: 10px;
    font-weight: 700;
  }

  .history-overview-copy strong {
    color: var(--emerald-dark);
    font-family: var(--font-manrope), sans-serif;
    font-size: 19px;
    font-weight: 800;
  }

  .history-overview-copy small {
    color: #9aa39b;
    font-size: 10px;
  }

  .history-overview-total {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 5px;
  }

  .history-overview-total strong {
    color: var(--emerald);
    font-family: var(--font-manrope), sans-serif;
    font-size: 23px;
    font-weight: 800;
    white-space: nowrap;
  }

  /* STATISTICS */

  .history-stat-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 14px;
    margin-bottom: 20px;
  }

  .history-stat-card {
    position: relative;
    min-width: 0;
    overflow: hidden;
    padding: 20px;
    border: 1px solid var(--line);
    border-radius: 16px;
    background: #fff;
    box-shadow: 0 5px 18px rgba(24,55,37,.035);
    transition: transform .2s ease, box-shadow .2s ease;
  }

  .history-stat-card:hover {
    transform: translateY(-3px);
    box-shadow: 0 10px 25px rgba(24,55,37,.07);
  }

  .history-stat-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 15px;
  }

  .history-stat-top > span:first-child {
    color: #7e8a80;
    font-size: 11px;
    font-weight: 700;
  }

  .history-stat-icon {
    display: grid;
    place-items: center;
    width: 35px;
    height: 35px;
    flex-shrink: 0;
    border-radius: 10px;
  }

  .history-stat-icon.green {
    background: #edf5ed;
    color: #3e754b;
  }

  .history-stat-icon.gold {
    background: #fbf5e9;
    color: #a17b35;
  }

  .history-stat-icon.blue {
    background: #edf3f8;
    color: #52758e;
  }

  .history-stat-icon.rose {
    background: #fbefed;
    color: #a45d62;
  }

  .history-stat-card > strong {
    display: block;
    color: var(--emerald-dark);
    font-family: var(--font-manrope), sans-serif;
    font-size: clamp(19px, 2vw, 27px);
    font-weight: 800;
    letter-spacing: -.7px;
    overflow-wrap: anywhere;
  }

  .history-stat-card > small {
    display: block;
    margin-top: 6px;
    color: #9aa39b;
    font-size: 10px;
  }

  /* PANEL */

  .history-filter-card,
  .history-table-card {
    min-width: 0;
    margin-bottom: 20px;
    padding: 24px;
    border: 1px solid var(--line);
    border-radius: 19px;
    background: #fff;
    box-shadow: 0 6px 22px rgba(24,55,37,.035);
  }

  .history-section-title {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .history-title-icon {
    display: grid;
    place-items: center;
    width: 39px;
    height: 39px;
    flex-shrink: 0;
    border-radius: 11px;
    background: var(--emerald-soft);
    color: var(--emerald);
  }

  .history-section-title h2 {
    margin: 0 0 6px;
    color: var(--emerald-dark);
    font-family: var(--font-manrope), sans-serif;
    font-size: 16px;
    font-weight: 800;
  }

  .history-section-title p {
    margin: 0;
    color: #89938a;
    font-size: 10px;
    line-height: 1.7;
  }

  /* FILTER */

  .history-filter-grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1.4fr;
    gap: 13px;
    margin-top: 22px;
  }

  .history-field {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 0;
  }

  .history-field > span {
    color: #526157;
    font-size: 10px;
    font-weight: 800;
  }

  .history-input-wrap {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
    min-height: 43px;
    padding: 0 12px;
    border: 1px solid #e2e8e1;
    border-radius: 10px;
    background: #fafbf9;
    color: #8a988d;
    transition: .18s ease;
  }

  .history-input-wrap:focus-within {
    border-color: #789b83;
    background: #fff;
    box-shadow: 0 0 0 3px rgba(45,105,68,.09);
  }

  .history-input-wrap input {
    width: 100%;
    min-width: 0;
    height: 40px;
    padding: 0;
    border: 0;
    outline: none;
    background: transparent;
    color: #304136;
    font-family: inherit;
    font-size: 11px;
  }

  .history-input-wrap input::placeholder {
    color: #b1b9b1;
  }

  /* TABLE HEADER */

  .history-table-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 15px;
    margin-bottom: 19px;
  }

  .history-data-count {
    padding: 8px 12px;
    border: 1px solid #dce8de;
    border-radius: 9px;
    background: var(--emerald-soft);
    color: var(--emerald);
    font-size: 10px;
    font-weight: 800;
    white-space: nowrap;
  }

  /* TABLE */

  .history-table-scroll {
    width: 100%;
    overflow-x: auto;
    border: 1px solid #e7ece6;
    border-radius: 13px;
  }

  .history-table {
    width: 100%;
    min-width: 1000px;
    border-collapse: separate;
    border-spacing: 0;
    font-size: 11px;
  }

  .history-table th {
    padding: 15px 13px;
    border-bottom: 1px solid #e6ebe5;
    background: #f5f7f3;
    color: #66766a;
    text-align: left;
    white-space: nowrap;
    font-size: 9px;
    font-weight: 800;
    letter-spacing: .4px;
  }

  .history-table td {
    padding: 15px 13px;
    border-bottom: 1px solid #edf0eb;
    color: #758077;
    vertical-align: middle;
  }

  .history-table tbody tr {
    transition: background .15s ease;
  }

  .history-table tbody tr:hover {
    background: #f8faf7;
  }

  .history-table tbody tr:last-child td {
    border-bottom: 0;
  }

  .history-row-number {
    color: #a2aaa2 !important;
    font-size: 10px;
    font-weight: 700;
  }

  .history-receipt-number {
    color: var(--emerald);
    font-size: 11px;
    font-weight: 800;
    white-space: nowrap;
  }

  .history-date {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    color: #718075;
    white-space: nowrap;
  }

  .history-payment {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 7px 9px;
    border: 1px solid #dcebdd;
    border-radius: 8px;
    background: #edf6ed;
    color: #3e754b;
    font-size: 9px;
    font-weight: 800;
    white-space: nowrap;
  }

  .history-money-muted {
    color: #a17b35 !important;
    white-space: nowrap;
  }

  .history-total {
    color: var(--emerald);
    font-size: 12px;
    font-weight: 800;
    white-space: nowrap;
  }

  .align-right {
    text-align: right !important;
  }

  .align-center {
    text-align: center !important;
  }

  .history-detail-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    min-height: 33px;
    padding: 0 11px;
    border: 1px solid #dce7dd;
    border-radius: 8px;
    background: #f0f5f0;
    color: var(--emerald);
    font-family: inherit;
    font-size: 10px;
    font-weight: 800;
    cursor: pointer;
    transition: .18s ease;
  }

  .history-detail-button:hover {
    border-color: var(--emerald);
    background: var(--emerald);
    color: #fff;
  }

  .history-table tfoot td {
    padding: 15px 13px;
    border-top: 1px solid #e3eae2;
    background: #f5f7f3;
    color: var(--emerald);
    font-size: 10px;
    font-weight: 800;
    white-space: nowrap;
  }

  /* EMPTY STATE */

  .history-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 220px;
    padding: 35px 18px;
    color: #8a958b;
    text-align: center;
    font-size: 11px;
  }

  .history-empty-icon {
    display: grid;
    place-items: center;
    width: 56px;
    height: 56px;
    margin-bottom: 14px;
    border-radius: 16px;
    background: var(--emerald-soft);
    color: var(--emerald);
  }

  .history-empty h3 {
    margin: 0;
    color: #42594a;
    font-family: var(--font-manrope), sans-serif;
    font-size: 14px;
    font-weight: 800;
  }

  .history-empty p {
    margin: 7px 0 0;
    color: #8a958b;
    font-size: 10px;
  }

  /* FOOTER */

  .history-footer {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 16px 0 5px;
    color: #9aa39b;
    font-size: 10px;
  }

  .history-footer span {
    color: var(--emerald);
    font-weight: 800;
    letter-spacing: 1px;
  }

  .history-footer i {
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: var(--gold);
  }

  /* MODAL */

  .history-modal-backdrop {
    position: fixed;
    z-index: 9999;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    background: rgba(15,35,25,.48);
    backdrop-filter: blur(5px);
  }

  .history-modal {
    display: flex;
    flex-direction: column;
    width: 100%;
    max-width: 560px;
    max-height: 90vh;
    overflow: hidden;
    border: 1px solid #e3e9df;
    border-radius: 20px;
    background: #fff;
    box-shadow: 0 24px 80px rgba(10,35,22,.22);
  }

  .history-modal-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 15px;
    padding: 22px 24px;
    border-bottom: 1px solid #edf0eb;
    background: linear-gradient(115deg, #fff, #f5f8f3);
  }

  .history-modal-eyebrow {
    margin-bottom: 7px;
    color: var(--gold);
    font-size: 9px;
    font-weight: 800;
    letter-spacing: 2px;
  }

  .history-modal-header h2 {
    margin: 0;
    color: var(--emerald-dark);
    font-family: var(--font-manrope), sans-serif;
    font-size: 20px;
    font-weight: 800;
  }

  .history-modal-header p {
    margin: 6px 0 0;
    color: #879188;
    font-size: 10px;
  }

  .history-modal-close {
    display: grid;
    place-items: center;
    width: 36px;
    height: 36px;
    flex-shrink: 0;
    border: 1px solid #e7ece6;
    border-radius: 10px;
    background: #f8faf7;
    color: #68776b;
    cursor: pointer;
  }

  .history-modal-close:hover {
    background: #edf4ef;
    color: var(--emerald);
  }

  .history-modal-body {
    overflow-y: auto;
    padding: 24px;
    background: #fff;
  }

  .history-receipt-brand {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding-bottom: 19px;
    border-bottom: 1px dashed #dce3dc;
    text-align: center;
  }

  .history-receipt-logo {
    display: grid;
    place-items: center;
    width: 42px;
    height: 42px;
    margin-bottom: 9px;
    border-radius: 12px;
    background: var(--emerald);
    color: #fff;
    font-family: var(--font-manrope), sans-serif;
    font-size: 21px;
    font-weight: 900;
  }

  .history-receipt-brand h2 {
    margin: 0;
    color: var(--emerald-dark);
    font-family: var(--font-manrope), sans-serif;
    font-size: 17px;
    font-weight: 900;
    letter-spacing: 1px;
  }

  .history-receipt-brand p {
    margin: 4px 0 10px;
    color: var(--muted);
    font-size: 10px;
  }

  .history-receipt-brand > span {
    color: var(--ink);
    font-size: 10px;
    font-weight: 800;
  }

  .history-receipt-brand small {
    margin-top: 5px;
    color: var(--muted);
    font-size: 10px;
  }

  .history-receipt-meta {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    padding: 16px 0;
    border-bottom: 1px dashed #dce3dc;
  }

  .history-receipt-meta div {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .history-receipt-meta span,
  .history-receipt-totals span {
    color: var(--muted);
    font-size: 10px;
  }

  .history-receipt-meta strong {
    color: var(--ink);
    font-size: 11px;
  }

  .history-receipt-items {
    padding: 12px 0;
    border-bottom: 1px dashed #dce3dc;
  }

  .history-receipt-item {
    display: flex;
    justify-content: space-between;
    gap: 15px;
    padding: 10px 0;
  }

  .history-receipt-item > div:first-child {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }

  .history-receipt-item strong {
    color: var(--ink);
    font-size: 11px;
  }

  .history-receipt-item small {
    color: var(--muted);
    font-size: 10px;
  }

  .history-receipt-line {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 5px;
    flex-shrink: 0;
  }

  .history-receipt-line span {
    color: var(--muted);
    font-size: 10px;
    white-space: nowrap;
  }

  .history-receipt-line strong {
    color: var(--ink);
    font-size: 11px;
    white-space: nowrap;
  }

  .history-detail-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 9px;
    padding: 25px;
    color: var(--muted);
    font-size: 11px;
  }

  .history-no-items {
    color: var(--muted);
    font-size: 11px;
    text-align: center;
  }

  .history-receipt-totals {
    display: flex;
    flex-direction: column;
    gap: 11px;
    padding: 17px 0;
  }

  .history-receipt-totals > div {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .history-receipt-totals strong {
    color: var(--ink);
    font-size: 11px;
    white-space: nowrap;
  }

  .history-receipt-totals .receipt-grand-total {
    margin: 3px 0;
    padding: 13px;
    border-radius: 10px;
    background: var(--emerald-soft);
  }

  .history-receipt-totals .receipt-grand-total span,
  .history-receipt-totals .receipt-grand-total strong {
    color: var(--emerald);
    font-size: 13px;
    font-weight: 900;
  }

  .history-receipt-thanks {
    margin: 5px 0 0;
    color: var(--muted);
    font-size: 10px;
    text-align: center;
  }

  .history-modal-actions {
    display: flex;
    gap: 10px;
    padding: 15px 22px;
    border-top: 1px solid var(--line);
    background: #fafbf9;
  }

  .history-print-button,
  .history-close-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 41px;
    padding: 0 16px;
    border-radius: 9px;
    font-family: inherit;
    font-size: 11px;
    font-weight: 800;
    cursor: pointer;
    transition: .18s ease;
  }

  .history-print-button {
    flex: 1;
    border: 0;
    background: linear-gradient(135deg, #205a3e, #123d2b);
    color: #fff;
  }

  .history-print-button:hover:not(:disabled) {
    background: var(--emerald-dark);
  }

  .history-print-button:disabled {
    opacity: .5;
    cursor: not-allowed;
  }

  .history-close-button {
    border: 1px solid #e0e8df;
    background: #fff;
    color: #617365;
  }

  .history-close-button:hover {
    background: #f0f5f0;
  }

  /* ANIMATION */

  .history-spin {
    animation: history-rotate 1s linear infinite;
  }

  @keyframes history-rotate {
    to { transform: rotate(360deg); }
  }

  /* RESPONSIVE */

  @media (max-width: 1100px) {
    .history-stat-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .history-filter-grid {
      grid-template-columns: 1fr 1fr;
    }

    .history-search-field {
      grid-column: 1 / -1;
    }
  }

  @media (max-width: 700px) {
    .history-page {
      padding: 16px;
    }

    .history-header {
      align-items: flex-start;
      flex-direction: column;
      padding: 23px 20px;
      border-radius: 17px;
    }

    .history-refresh {
      width: 100%;
    }

    .history-overview {
      align-items: flex-start;
      flex-direction: column;
      padding: 18px;
    }

    .history-overview-total {
      align-items: flex-start;
      padding-left: 58px;
    }

    .history-stat-grid {
      gap: 9px;
    }

    .history-stat-card {
      padding: 15px;
    }

    .history-filter-card,
    .history-table-card {
      padding: 17px;
      border-radius: 15px;
    }

    .history-filter-grid {
      grid-template-columns: 1fr;
      gap: 13px;
    }

    .history-search-field {
      grid-column: auto;
    }

    .history-table-heading {
      align-items: flex-start;
    }

    .history-modal-backdrop {
      align-items: flex-end;
      padding: 0;
    }

    .history-modal {
      max-height: 92vh;
      border-radius: 20px 20px 0 0;
    }

    .history-modal-body {
      padding: 19px;
    }
  }

  @media (max-width: 380px) {
    .history-stat-grid {
      grid-template-columns: 1fr;
    }

    .history-overview-total {
      padding-left: 0;
    }

    .history-modal-actions {
      flex-direction: column;
    }
  }

  /* PRINT STRUK */

  @media print {
    @page {
      size: 80mm auto;
      margin: 0;
    }

    body * {
      visibility: hidden !important;
    }

    #sale-detail-print,
    #sale-detail-print * {
      visibility: visible !important;
    }

    #sale-detail-print {
      position: absolute !important;
      left: 0 !important;
      top: 0 !important;
      width: 72mm !important;
      padding: 4mm !important;
      margin: 0 !important;
      color: #111 !important;
      background: #fff !important;
      box-shadow: none !important;
      font-family: Arial, sans-serif !important;
    }

    .history-modal-header,
    .history-modal-actions {
      display: none !important;
    }
  }
`}</style>

    </main>
  );
}
