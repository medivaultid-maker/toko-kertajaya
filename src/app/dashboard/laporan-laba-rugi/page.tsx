"use client";

import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase";
import {
  CalendarDays,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Wallet,
  Package,
  Receipt,
  CircleDollarSign,
  AlertCircle,
  Info,
} from "lucide-react";

type Sale = {
  id: string;
  receipt_number: string;
  subtotal: number;
  discount: number;
  total: number;
  status: string;
  created_at: string;
};

type SaleItem = {
  id: string;
  sale_id: string;
  quantity: number;
  purchase_cost_snapshot: number | null;
};

type FinancialIncome = {
  id: string;
  category: string;
  description: string;
  amount: number;
  income_date: string;
};

type FinancialExpense = {
  id: string;
  category: string;
  description: string;
  amount: number;
  expense_date: string;
};

type Payroll = {
  id: string;
  gross_salary: number;
  absence_deduction: number;
  debt_deduction: number;
  net_salary: number;
  paid_at: string;
  payment_status: string;
};

type ReportData = {
  sales: Sale[];
  saleItems: SaleItem[];
  incomes: FinancialIncome[];
  expenses: FinancialExpense[];
  payrolls: Payroll[];
};

type BreakdownItem = { category: string; amount: number };

const rupiah = (value: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

function getTodayWIB() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return `${year}-${month}-${day}`;
}

function getDateBoundsWIB(dateFrom: string, dateTo: string) {
  const start = new Date(`${dateFrom}T00:00:00+07:00`);
  const end = new Date(`${dateTo}T00:00:00+07:00`);
  end.setTime(end.getTime() + 24 * 60 * 60 * 1000);
  return { start: start.toISOString(), end: end.toISOString() };
}

function localDateLabel(date: string) {
  if (!date) return "—";
  return new Date(`${date}T12:00:00+07:00`).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  });
}

function normalizeCategory(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase();
}

function groupByCategory<T extends { category: string; amount: number }>(
  rows: T[]
): BreakdownItem[] {
  const grouped = new Map<string, number>();
  rows.forEach((row) => {
    const category = row.category || "Tanpa kategori";
    grouped.set(category, (grouped.get(category) || 0) + Number(row.amount || 0));
  });
  return Array.from(grouped.entries())
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);
}

function MetricCard({
  label,
  value,
  note,
  icon,
  tone = "green",
}: {
  label: string;
  value: number;
  note: string;
  icon: ReactNode;
  tone?: "green" | "red" | "gold" | "blue";
}) {
  return (
    <article className={`metric-card metric-${tone}`}>
      <div className="metric-top">
        <span>{label}</span>
        <div className="metric-icon">{icon}</div>
      </div>
      <strong>{rupiah(value)}</strong>
      <small>{note}</small>
      <style jsx>{`
        .metric-card {
          min-width: 0;
          padding: 20px;
          border: 1px solid #e8ece6;
          border-radius: 15px;
          background: #fff;
          box-shadow: 0 5px 18px rgba(24, 55, 37, .04);
          transition: transform .2s ease, box-shadow .2s ease;
        }
        .metric-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 10px 25px rgba(24, 55, 37, .08);
        }
        .metric-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 18px;
        }
        .metric-top > span {
          color: #7e8a80;
          font-size: 11px;
          font-weight: 800;
        }
        .metric-icon {
          display: grid;
          place-items: center;
          width: 39px;
          height: 39px;
          flex-shrink: 0;
          border-radius: 11px;
          background: #edf4ef;
          color: #174b36;
        }
        .metric-card > strong {
          display: block;
          color: #103a2a;
          font-family: var(--font-manrope), sans-serif;
          font-size: clamp(18px, 1.6vw, 24px);
          font-weight: 800;
          letter-spacing: -.6px;
          line-height: 1.4;
          overflow-wrap: anywhere;
        }
        .metric-card > small {
          display: block;
          margin-top: 8px;
          color: #929d93;
          font-size: 10px;
          line-height: 1.7;
        }
        .metric-green .metric-icon { background: #edf6ef; color: #28784a; }
        .metric-red .metric-icon { background: #fbefed; color: #b34e4e; }
        .metric-gold .metric-icon { background: #fbf5e9; color: #a17b35; }
        .metric-blue .metric-icon { background: #edf3f8; color: #52758e; }
        @media (max-width: 700px) {
          .metric-card { padding: 15px; }
          .metric-card > strong { font-size: 17px; }
          .metric-top > span { font-size: 10px; }
        }
      `}</style>
    </article>
  );
}

export default function LabaRugiPage() {
  const [supabase] = useState(() => createClient());
  const today = getTodayWIB();
  const [dateFrom, setDateFrom] = useState(`${today.slice(0, 7)}-01`);
  const [dateTo, setDateTo] = useState(today);
  const [report, setReport] = useState<ReportData>({
    sales: [],
    saleItems: [],
    incomes: [],
    expenses: [],
    payrolls: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadReport = useCallback(async () => {
    if (!dateFrom || !dateTo) {
      setError("Tanggal awal dan akhir harus diisi.");
      return;
    }
    if (dateFrom > dateTo) {
      setError("Tanggal awal tidak boleh melebihi tanggal akhir.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user) {
        window.location.replace("/login");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role,is_active")
        .eq("id", user.id)
        .maybeSingle();
      if (profileError) throw profileError;

      const allowed =
        profile?.is_active === true &&
        ["owner", "admin"].includes(String(profile?.role || "").toLowerCase());
      if (!allowed) {
        throw new Error("Laporan laba rugi hanya dapat diakses Owner atau Admin aktif.");
      }

      const { start, end } = getDateBoundsWIB(dateFrom, dateTo);
      const [salesResult, incomesResult, expensesResult, payrollsResult] =
        await Promise.all([
          supabase
            .from("sales")
            .select("id,receipt_number,subtotal,discount,total,status,created_at")
            .eq("status", "completed")
            .gte("created_at", start)
            .lt("created_at", end)
            .order("created_at", { ascending: false }),
          supabase
            .from("financial_incomes")
            .select("id,category,description,amount,income_date")
            .gte("income_date", dateFrom)
            .lte("income_date", dateTo),
          supabase
            .from("financial_expenses")
            .select("id,category,description,amount,expense_date")
            .gte("expense_date", dateFrom)
            .lte("expense_date", dateTo),
          supabase
            .from("employee_payrolls")
            .select("id,gross_salary,absence_deduction,debt_deduction,net_salary,paid_at,payment_status")
            .eq("payment_status", "paid")
            .gte("paid_at", start)
            .lt("paid_at", end),
        ]);

      if (salesResult.error) throw salesResult.error;
      if (incomesResult.error) throw incomesResult.error;
      if (expensesResult.error) throw expensesResult.error;
      if (payrollsResult.error) throw payrollsResult.error;

      const sales = (salesResult.data || []) as Sale[];
      const incomes = (incomesResult.data || []) as FinancialIncome[];
      const expenses = (expensesResult.data || []) as FinancialExpense[];
      const payrolls = (payrollsResult.data || []) as Payroll[];
      let saleItems: SaleItem[] = [];
      const saleIds = sales.map((sale) => sale.id);

      if (saleIds.length > 0) {
        const { data: itemData, error: itemError } = await supabase
          .from("sale_items")
          .select("id,sale_id,quantity,purchase_cost_snapshot")
          .in("sale_id", saleIds);
        if (itemError) throw itemError;
        saleItems = (itemData || []) as SaleItem[];
      }

      setReport({ sales, saleItems, incomes, expenses, payrolls });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat laporan laba rugi.");
      setReport({ sales: [], saleItems: [], incomes: [], expenses: [], payrolls: [] });
    } finally {
      setLoading(false);
    }
  }, [supabase, dateFrom, dateTo]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  const grossSales = report.sales.reduce((sum, sale) => sum + Number(sale.subtotal || 0), 0);
  const totalDiscount = report.sales.reduce((sum, sale) => sum + Number(sale.discount || 0), 0);
  const netSales = report.sales.reduce((sum, sale) => sum + Number(sale.total || 0), 0);
  const totalHpp = report.saleItems.reduce(
    (sum, item) => sum + Number(item.purchase_cost_snapshot || 0) * Number(item.quantity || 0),
    0
  );
  const grossProfit = netSales - totalHpp;
  const totalItemsSold = report.saleItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0);

  const operatingIncomeRows = report.incomes.filter((item) =>
    ["pemasukan lain", "pendapatan lain"].includes(normalizeCategory(item.category))
  );
  const capitalContributionRows = report.incomes.filter(
    (item) => normalizeCategory(item.category) === "setoran tambahan"
  );
  const nonCashSalesRows = report.incomes.filter(
    (item) => normalizeCategory(item.category) === "penjualan non-kasir"
  );
  const refundRows = report.incomes.filter(
    (item) => normalizeCategory(item.category) === "pengembalian dana"
  );
  const excludedCategories = [
    "pemasukan lain",
    "pendapatan lain",
    "setoran tambahan",
    "penjualan non-kasir",
    "pengembalian dana",
  ];
  const unclassifiedIncomeRows = report.incomes.filter(
    (item) => !excludedCategories.includes(normalizeCategory(item.category))
  );

  const sumAmounts = (rows: { amount: number }[]) =>
    rows.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const otherOperatingIncome = sumAmounts(operatingIncomeRows);
  const capitalContribution = sumAmounts(capitalContributionRows);
  const nonCashSales = sumAmounts(nonCashSalesRows);
  const refunds = sumAmounts(refundRows);
  const unclassifiedIncome = sumAmounts(unclassifiedIncomeRows);

  const totalExpenses = sumAmounts(report.expenses);
  // Beban gaji = gaji kotor dikurangi potongan absensi.
  // Potongan piutang pegawai bukan pengurang beban gaji.
  const totalPayroll = report.payrolls.reduce(
    (sum, item) =>
      sum + Math.max(0, Number(item.gross_salary || 0) - Number(item.absence_deduction || 0)),
    0
  );
  const totalOperatingExpenses = totalExpenses + totalPayroll;
  const netProfit = grossProfit + otherOperatingIncome - totalOperatingExpenses;
  const profitMargin = netSales > 0 ? (netProfit / netSales) * 100 : 0;
  const expenseBreakdown = groupByCategory(report.expenses);
  const incomeBreakdown = groupByCategory(operatingIncomeRows);

  function handleQuickPeriod(period: "today" | "month") {
    const currentDate = getTodayWIB();
    setDateTo(currentDate);
    setDateFrom(period === "today" ? currentDate : `${currentDate.slice(0, 7)}-01`);
  }

  return (
    <main className="profit-page">
      <header className="profit-hero">
        <div>
          <span className="profit-eyebrow">TOKO ROSYIDAH · LAPORAN KEUANGAN</span>
          <h1>Laporan Laba Rugi</h1>
          <p>Pantau omzet, HPP, laba kotor, dan laba bersih berdasarkan transaksi serta biaya yang tercatat.</p>
        </div>
        <div className="hero-icon"><CircleDollarSign size={34} /></div>
      </header>

      <section className="filter-panel">
        <div className="section-heading">
          <div className="section-icon"><CalendarDays size={19} /></div>
          <div>
            <h2>Periode Laporan</h2>
            <p>Pilih rentang tanggal yang ingin dianalisis.</p>
          </div>
        </div>

        <div className="filter-content">
          <label className="date-field">
            <span>Tanggal awal</span>
            <input type="date" value={dateFrom} max={dateTo} onChange={(event) => setDateFrom(event.target.value)} />
          </label>
          <label className="date-field">
            <span>Tanggal akhir</span>
            <input type="date" value={dateTo} min={dateFrom} max={today} onChange={(event) => setDateTo(event.target.value)} />
          </label>
          <div className="quick-period">
            <button type="button" onClick={() => handleQuickPeriod("today")}>Hari ini</button>
            <button type="button" onClick={() => handleQuickPeriod("month")}>Bulan ini</button>
          </div>
          <button type="button" className="refresh-button" onClick={() => void loadReport()} disabled={loading}>
            <RefreshCw size={16} className={loading ? "spin" : ""} />
            {loading ? "Memuat..." : "Muat laporan"}
          </button>
        </div>
        <div className="period-caption">Periode: {localDateLabel(dateFrom)} – {localDateLabel(dateTo)}</div>
      </section>

      {error && <div className="report-alert"><AlertCircle size={19} /><span>{error}</span></div>}

      <section className="metric-grid">
        <MetricCard label="Penjualan Bersih" value={netSales} note={`${report.sales.length} transaksi selesai`} icon={<Receipt size={19} />} tone="blue" />
        <MetricCard label="Total HPP" value={totalHpp} note={`${totalItemsSold.toLocaleString("id-ID")} unit terjual`} icon={<Package size={19} />} tone="gold" />
        <MetricCard label="Laba Kotor" value={grossProfit} note="Penjualan bersih dikurangi HPP" icon={<TrendingUp size={19} />} tone="green" />
        <MetricCard label="Laba Bersih" value={netProfit} note="Setelah pendapatan lain dan beban tercatat" icon={<CircleDollarSign size={19} />} tone={netProfit >= 0 ? "green" : "red"} />
      </section>

      {report.sales.length > 0 && totalHpp === 0 && !loading && (
        <div className="report-alert warning-alert">
          <AlertCircle size={19} />
          <span>HPP tercatat Rp0 meskipun ada penjualan. Periksa nilai <strong>purchase_cost_snapshot</strong> pada detail transaksi; laba kotor dan laba bersih mungkin belum akurat.</span>
        </div>
      )}

      <section className="report-card">
        <div className="section-heading">
          <div className="section-icon"><Receipt size={19} /></div>
          <div>
            <h2>Rincian Perhitungan Laba Rugi</h2>
            <p>Rincian pembentukan laba selama periode terpilih.</p>
          </div>
        </div>

        {loading ? (
          <div className="empty-state"><RefreshCw size={23} className="spin" /><span>Menghitung laporan...</span></div>
        ) : (
          <div className="statement">
            <div className="statement-group">
              <div className="statement-group-title">PENDAPATAN PENJUALAN</div>
              <div className="statement-row"><span>Penjualan kotor</span><strong>{rupiah(grossSales)}</strong></div>
              <div className="statement-row deduction"><span>Diskon penjualan</span><strong>− {rupiah(totalDiscount)}</strong></div>
              <div className="statement-row subtotal-row"><span>Penjualan bersih</span><strong>{rupiah(netSales)}</strong></div>
            </div>
            <div className="statement-group">
              <div className="statement-group-title">HARGA POKOK PENJUALAN</div>
              <div className="statement-row deduction"><span>HPP barang terjual</span><strong>− {rupiah(totalHpp)}</strong></div>
              <div className="statement-row result-row"><span>Laba kotor</span><strong>{rupiah(grossProfit)}</strong></div>
            </div>
            <div className="statement-group">
              <div className="statement-group-title">PENDAPATAN DAN BEBAN LAIN</div>
              <div className="statement-row"><span>Pendapatan lain yang diakui</span><strong className="positive">+ {rupiah(otherOperatingIncome)}</strong></div>
              <div className="statement-row"><span>Beban operasional</span><strong className="negative">− {rupiah(totalExpenses)}</strong></div>
              <div className="statement-row"><span>Beban gaji pegawai</span><strong className="negative">− {rupiah(totalPayroll)}</strong></div>
              <div className="statement-row subtotal-row"><span>Total beban usaha</span><strong>{rupiah(totalOperatingExpenses)}</strong></div>
            </div>
            <div className={`net-profit-row ${netProfit < 0 ? "loss-row" : ""}`}>
              <div><span>HASIL AKHIR</span><strong>{netProfit >= 0 ? "LABA BERSIH" : "RUGI BERSIH"}</strong></div>
              <strong>{rupiah(netProfit)}</strong>
            </div>
            <div className="margin-row"><span>Margin laba bersih</span><strong>{profitMargin.toFixed(2)}%</strong></div>
          </div>
        )}
      </section>

      <section className="breakdown-grid">
        <div className="report-card">
          <div className="section-heading">
            <div className="section-icon income-icon"><TrendingUp size={19} /></div>
            <div><h2>Pendapatan Lain</h2><p>Pemasukan yang masuk dalam perhitungan laba.</p></div>
          </div>
          {incomeBreakdown.length === 0 ? (
            <div className="mini-empty">Belum ada pendapatan lain pada periode ini.</div>
          ) : (
            <div className="breakdown-list">
              {incomeBreakdown.map((item) => <div key={item.category} className="breakdown-row"><span>{item.category}</span><strong>{rupiah(item.amount)}</strong></div>)}
            </div>
          )}
          <div className="breakdown-total"><span>Total pendapatan lain</span><strong>{rupiah(otherOperatingIncome)}</strong></div>
        </div>

        <div className="report-card">
          <div className="section-heading">
            <div className="section-icon expense-icon"><TrendingDown size={19} /></div>
            <div><h2>Beban Operasional</h2><p>Rincian pengeluaran yang dicatat toko.</p></div>
          </div>
          {expenseBreakdown.length === 0 ? (
            <div className="mini-empty">Belum ada pengeluaran pada periode ini.</div>
          ) : (
            <div className="breakdown-list">
              {expenseBreakdown.map((item) => <div key={item.category} className="breakdown-row"><span>{item.category}</span><strong>{rupiah(item.amount)}</strong></div>)}
            </div>
          )}
          <div className="breakdown-total"><span>Total pengeluaran</span><strong>{rupiah(totalExpenses)}</strong></div>
        </div>
      </section>

      <section className="report-card">
        <div className="section-heading">
          <div className="section-icon"><Wallet size={19} /></div>
          <div>
            <h2>Pemasukan di Luar Laba Rugi</h2>
            <p>Tetap ditampilkan untuk transparansi, tetapi tidak otomatis dianggap sebagai keuntungan.</p>
          </div>
        </div>
        <div className="excluded-grid">
          <div className="excluded-item"><span>Setoran tambahan pemilik</span><strong>{rupiah(capitalContribution)}</strong><small>Bukan pendapatan usaha.</small></div>
          <div className="excluded-item"><span>Penjualan non-kasir</span><strong>{rupiah(nonCashSales)}</strong><small>Belum dihitung karena HPP barang belum tersedia.</small></div>
          <div className="excluded-item"><span>Pengembalian dana</span><strong>{rupiah(refunds)}</strong><small>Perlu ditentukan apakah pengembalian beban atau transaksi lainnya.</small></div>
          <div className="excluded-item"><span>Pemasukan belum diklasifikasikan</span><strong>{rupiah(unclassifiedIncome)}</strong><small>Tidak dimasukkan ke laba sampai kategorinya jelas.</small></div>
        </div>
      </section>

      <section className="info-panel">
        <Info size={18} />
        <div>
          <strong>Catatan metode perhitungan</strong>
          <p>HPP menggunakan snapshot harga pokok saat transaksi penjualan. Beban gaji diambil dari payroll yang berstatus paid pada periode pembayaran, dihitung dari gaji kotor dikurangi potongan absensi. Potongan piutang pegawai tidak mengurangi beban gaji. Jangan mencatat pembayaran gaji yang sama lagi sebagai pengeluaran manual agar tidak terhitung dua kali.</p>
          <p>Laba bersih pada halaman ini merupakan estimasi berdasarkan pendapatan dan biaya yang sudah tercatat di sistem. Biaya yang belum dicatat tidak akan masuk dalam laporan.</p>
        </div>
      </section>

      <footer className="report-footer"><span>TOKO ROSYIDAH</span><i />Laporan keuangan internal</footer>

      <style jsx>{`
        .profit-page {
          --green: #174b36;
          --green-dark: #103a2a;
          --gold: #b99a62;
          --ink: #26352c;
          --line: #e8ece6;
          display: flex;
          flex-direction: column;
          gap: 20px;
          width: 100%;
          min-width: 0;
          padding-bottom: 35px;
          color: var(--ink);
          font-family: var(--font-dm-sans), sans-serif;
        }
        .profit-hero {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          padding: 30px 32px;
          border: 1px solid #e5e9e1;
          border-radius: 20px;
          background: linear-gradient(115deg, #fff, #f3f7f1);
        }
        .profit-eyebrow { color: var(--gold); font-size: 10px; font-weight: 800; letter-spacing: 2px; }
        .profit-hero h1 { margin: 10px 0 8px; color: var(--green-dark); font-family: var(--font-manrope), sans-serif; font-size: 30px; font-weight: 800; letter-spacing: -1px; }
        .profit-hero p { max-width: 650px; margin: 0; color: #7b877e; font-size: 12px; line-height: 1.8; }
        .hero-icon { display: grid; place-items: center; width: 65px; height: 65px; flex-shrink: 0; border: 1px solid #dce8de; border-radius: 18px; background: #edf4ef; color: var(--green); }
        .filter-panel, .report-card { min-width: 0; padding: 25px; border: 1px solid var(--line); border-radius: 17px; background: #fff; box-shadow: 0 5px 20px rgba(24,55,37,.035); }
        .section-heading { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
        .section-icon { display: grid; place-items: center; width: 41px; height: 41px; flex-shrink: 0; border-radius: 12px; background: #edf4ef; color: var(--green); }
        .income-icon { background: #edf6ef; color: #28784a; }
        .expense-icon { background: #fbefed; color: #a64d4d; }
        .section-heading h2 { margin: 0 0 5px; color: var(--green-dark); font-family: var(--font-manrope), sans-serif; font-size: 16px; font-weight: 800; }
        .section-heading p { margin: 0; color: #89938a; font-size: 11px; line-height: 1.6; }
        .filter-content { display: grid; grid-template-columns: minmax(0,1fr) minmax(0,1fr) auto auto; align-items: end; gap: 12px; }
        .date-field { display: flex; min-width: 0; flex-direction: column; gap: 8px; color: #526157; font-size: 10px; font-weight: 800; }
        .date-field input { width: 100%; min-height: 43px; box-sizing: border-box; padding: 0 11px; border: 1px solid #dfe8df; border-radius: 9px; background: #fafcf9; color: #304136; font-family: inherit; font-size: 11px; outline: none; }
        .date-field input:focus { border-color: #789b83; }
        .quick-period { display: flex; gap: 7px; }
        .quick-period button, .refresh-button { display: inline-flex; align-items: center; justify-content: center; min-height: 43px; padding: 0 12px; border: 1px solid #dce7dd; border-radius: 9px; background: #fff; color: var(--green); font-family: inherit; font-size: 10px; font-weight: 800; cursor: pointer; white-space: nowrap; }
        .quick-period button:hover { background: #edf4ef; }
        .refresh-button { gap: 8px; background: var(--green); color: #fff; }
        .refresh-button:disabled { opacity: .55; cursor: not-allowed; }
        .period-caption { margin-top: 15px; color: #89938a; font-size: 10px; }
        .report-alert { display: flex; align-items: flex-start; gap: 10px; padding: 14px 16px; border: 1px solid #f0d9d5; border-radius: 11px; background: #fff5f3; color: #a64d45; font-size: 11px; line-height: 1.7; }
        .report-alert svg { flex-shrink: 0; margin-top: 1px; }
        .warning-alert { border-color: #efdfb8; background: #fffbef; color: #896b2e; }
        .metric-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 13px; width: 100%; }
        .statement { display: flex; flex-direction: column; gap: 20px; }
        .statement-group { display: flex; flex-direction: column; gap: 0; }
        .statement-group-title { margin-bottom: 8px; padding-bottom: 10px; border-bottom: 1px solid #edf0eb; color: #9a865d; font-size: 9px; font-weight: 900; letter-spacing: 1.3px; }
        .statement-row { display: flex; align-items: center; justify-content: space-between; gap: 15px; padding: 11px 0; color: #67756a; font-size: 11px; }
        .statement-row strong { color: #405346; font-size: 11px; font-weight: 800; white-space: nowrap; }
        .statement-row.deduction strong, .negative { color: #b34e4e !important; }
        .positive { color: #28784a !important; }
        .subtotal-row { border-top: 1px dashed #e4e9e2; color: var(--green-dark); font-weight: 800; }
        .subtotal-row strong { color: var(--green-dark); }
        .result-row { margin-top: 4px; padding: 13px 14px; border: 1px solid #dce8de; border-radius: 10px; background: #f4f8f3; color: var(--green-dark); font-weight: 900; }
        .result-row strong { color: var(--green); font-size: 14px; }
        .net-profit-row { display: flex; align-items: center; justify-content: space-between; gap: 15px; margin-top: 5px; padding: 20px; border: 1px solid #dce8de; border-radius: 13px; background: #f1f7f1; color: var(--green); }
        .net-profit-row > div { display: flex; flex-direction: column; gap: 5px; }
        .net-profit-row span { color: #849087; font-size: 9px; font-weight: 800; letter-spacing: 1px; }
        .net-profit-row > div strong { color: var(--green-dark); font-size: 13px; font-weight: 900; }
        .net-profit-row > strong { font-family: var(--font-manrope), sans-serif; font-size: clamp(19px, 2vw, 26px); font-weight: 900; text-align: right; overflow-wrap: anywhere; }
        .loss-row { border-color: #f0d9d5; background: #fff4f2; color: #b34e4e; }
        .loss-row > div strong, .loss-row > strong { color: #b34e4e; }
        .margin-row { display: flex; justify-content: space-between; gap: 12px; padding: 0 3px; color: #849087; font-size: 10px; }
        .margin-row strong { color: var(--green); font-weight: 900; }
        .breakdown-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
        .breakdown-list { display: flex; flex-direction: column; }
        .breakdown-row { display: flex; justify-content: space-between; gap: 12px; padding: 12px 0; border-bottom: 1px solid #edf0eb; color: #68766b; font-size: 11px; }
        .breakdown-row strong { color: #405346; white-space: nowrap; }
        .breakdown-total { display: flex; justify-content: space-between; gap: 12px; margin-top: 12px; padding-top: 14px; border-top: 1px solid #e6ece5; color: var(--green-dark); font-size: 11px; font-weight: 900; }
        .breakdown-total strong { color: var(--green); white-space: nowrap; }
        .mini-empty { padding: 25px 10px; color: #9aa39b; font-size: 11px; text-align: center; }
        .excluded-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
        .excluded-item { display: flex; min-width: 0; flex-direction: column; gap: 7px; padding: 16px; border: 1px solid #edf0eb; border-radius: 11px; background: #fafbf9; }
        .excluded-item span { color: #7e8a80; font-size: 10px; font-weight: 700; }
        .excluded-item strong { color: #526157; font-size: 17px; font-weight: 900; overflow-wrap: anywhere; }
        .excluded-item small { color: #9aa39b; font-size: 9px; line-height: 1.6; }
        .info-panel { display: flex; align-items: flex-start; gap: 12px; padding: 17px 19px; border: 1px solid #e8e5d9; border-radius: 13px; background: #fcfbf7; color: #8b774f; }
        .info-panel > svg { flex-shrink: 0; margin-top: 2px; }
        .info-panel strong { color: #77633c; font-size: 11px; }
        .info-panel p { margin: 6px 0 0; color: #897f6d; font-size: 10px; line-height: 1.8; }
        .report-footer { display: flex; align-items: center; justify-content: center; gap: 9px; padding: 12px; color: #a0aaa1; font-size: 10px; }
        .report-footer span { color: #607564; font-weight: 900; letter-spacing: .7px; }
        .report-footer i { width: 4px; height: 4px; border-radius: 50%; background: #b99a62; }
        .empty-state { display: flex; align-items: center; justify-content: center; gap: 10px; padding: 35px; color: #89938a; font-size: 11px; }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 1050px) {
          .metric-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .filter-content { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .quick-period { grid-column: 1; }
          .refresh-button { grid-column: 2; }
        }
        @media (max-width: 700px) {
          .profit-page { gap: 15px; }
          .profit-hero { padding: 23px 20px; }
          .profit-hero h1 { font-size: 25px; }
          .hero-icon { width: 49px; height: 49px; }
          .filter-panel, .report-card { padding: 19px; }
          .filter-content { grid-template-columns: 1fr; }
          .quick-period, .refresh-button { grid-column: auto; }
          .refresh-button { width: 100%; }
          .breakdown-grid { grid-template-columns: 1fr; }
          .excluded-grid { grid-template-columns: 1fr; }
          .statement-row { font-size: 10px; }
          .statement-row strong { font-size: 10px; }
          .net-profit-row { padding: 15px; }
        }
      `}</style>
    </main>
  );
}
