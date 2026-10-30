
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
        !["admin", "cashier"].includes(profile.role)
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
        <a href="/dashboard" className="history-back">
          <ArrowLeft size={16} />
          Kembali ke Dashboard
        </a>

        <header className="history-header">
          <div>
            <div className="history-eyebrow">
              <span className="history-eyebrow-dot" />
              TOKO ROSYIDAH · PASAR SEBAUNG
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
                <p>Pasar Sebaung</p>
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
        @media print {
          @page { size: 80mm auto; margin: 0; }
          body * { visibility: hidden !important; }
          #sale-detail-print,
          #sale-detail-print * { visibility: visible !important; }
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
          }
          .history-modal-header,
          .history-modal-actions { display: none !important; }
        }
      `}</style>
    </main>
  );
}
