
"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import {
  Wallet,
  Lock,
  Unlock,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
} from "lucide-react";

type CashSession = {
  id: string;
  session_date: string;
  opening_cash: number;
  expected_closing_cash: number;
  closing_cash_actual: number | null;
  cash_difference: number | null;
  status: "open" | "closed";
  opened_at: string;
  closed_at: string | null;
  note: string | null;
};

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

  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;

  return `${year}-${month}-${day}`;
}

function getDayRange(date: string) {
  const start = new Date(`${date}T00:00:00+07:00`);

  return {
    start: start.toISOString(),
    end: new Date(
      start.getTime() + 24 * 60 * 60 * 1000
    ).toISOString(),
  };
}

export default function CashDrawerPage() {
  const [supabase] = useState(() => createClient());

  const [session, setSession] = useState<CashSession | null>(null);
  const [openingAmount, setOpeningAmount] = useState("");
  const [closingAmount, setClosingAmount] = useState("");
  const [note, setNote] = useState("");

  const [cashSales, setCashSales] = useState(0);
  const [cashPurchases, setCashPurchases] = useState(0);
  const [cashExpenses, setCashExpenses] = useState(0);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const today = getTodayWIB();

  const expectedCash =
    Number(session?.opening_cash || 0) +
    cashSales -
    cashPurchases -
    cashExpenses;

  const actualCash = Number(closingAmount || 0);
  const difference = actualCash - expectedCash;

 
const loadData = useCallback(async () => {
  setLoading(true);
  setError("");

  try {
    const { data, error: rpcError } = await supabase.rpc(
      "get_cash_drawer_summary"
    );

    if (rpcError) throw rpcError;

    if (!data) {
      throw new Error("Data rekap kas tidak ditemukan.");
    }

    const currentSession = data.session as CashSession | null;

    setSession(currentSession);
    setCashSales(Number(data.cash_sales || 0));
    setCashPurchases(Number(data.cash_purchases || 0));
    setCashExpenses(Number(data.cash_expenses || 0));
  } catch (err) {
    setError(
      err instanceof Error
        ? err.message
        : "Gagal memuat data kas."
    );
  } finally {
    setLoading(false);
  }
}, [supabase]);


  useEffect(() => {
    void loadData();
  }, [loadData]);

  
async function openSession() {
  const amount = Number(openingAmount);

  setError("");
  setMessage("");

  if (
    openingAmount.trim() === "" ||
    !Number.isFinite(amount) ||
    amount < 0
  ) {
    setError("Masukkan modal awal yang valid.");
    return;
  }

  if (session?.status === "open") {
    setError("Sesi kas hari ini sudah dibuka.");
    return;
  }

  setBusy(true);

  try {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) throw authError;

    if (!user) {
      throw new Error("Silakan login terlebih dahulu.");
    }

    const { error: insertError } = await supabase
      .from("cash_drawer_sessions")
      .insert({
        session_date: today,
        opening_cash: amount,
        expected_closing_cash: amount,
        status: "open",
        opened_by: user.id,
        note: note.trim() || null,
      });

    if (insertError) {
      if (insertError.code === "23505") {
        throw new Error(
          "Sesi kas hari ini sudah pernah dibuat."
        );
      }

      throw insertError;
    }

    setOpeningAmount("");
    setNote("");
    setMessage("Sesi kas berhasil dibuka.");

    await loadData();
  } catch (err) {
    setError(
      err instanceof Error
        ? err.message
        : "Gagal membuka sesi kas."
    );
  } finally {
    setBusy(false);
  }
}


  async function closeSession() {
  if (!session || session.status !== "open") return;

  const amount = Number(closingAmount);

  setError("");
  setMessage("");

  if (
    closingAmount.trim() === "" ||
    !Number.isFinite(amount) ||
    amount < 0
  ) {
    setError("Masukkan jumlah uang fisik saat tutup kas.");
    return;
  }

  const confirmed = window.confirm(
    "Yakin ingin menutup sesi kas hari ini? Transaksi kasir berikutnya akan ditolak."
  );

  if (!confirmed) return;

  setBusy(true);

  try {
    const { data, error: rpcError } = await supabase.rpc(
      "close_cash_drawer",
      {
        p_session_id: session.id,
        p_closing_cash: amount,
      }
    );

    if (rpcError) throw rpcError;

    if (!data?.success) {
      throw new Error("Penutupan kas tidak berhasil.");
    }

    setMessage("Sesi kas berhasil ditutup.");
    setClosingAmount("");

    await loadData();
  } catch (err) {
    setError(
      err instanceof Error
        ? err.message
        : "Gagal menutup sesi kas."
    );
  } finally {
    setBusy(false);
  }
}

  if (loading) {
    return (
      <div className="cash-loading">
        <RefreshCw className="spin" size={24} />
        <p>Memuat data kas harian...</p>
      </div>
    );
  }

  return (
    <main className="cash-page">
      <section className="cash-hero">
        <div>
          <span className="eyebrow">MANAJEMEN KAS TOKO</span>
          <h1>Buka & Tutup Kas</h1>
          <p>
            Pengelolaan satu laci kas bersama untuk seluruh
            transaksi tunai harian.
          </p>
        </div>

        <div className="date-chip">
          <Clock size={16} />
          {new Date(`${today}T12:00:00+07:00`).toLocaleDateString(
            "id-ID",
            {
              day: "numeric",
              month: "long",
              year: "numeric",
              timeZone: "Asia/Jakarta",
            }
          )}
        </div>
      </section>

      {error && (
        <div className="alert error">
          <AlertCircle size={18} />
          {error}
        </div>
      )}

      {message && (
        <div className="alert success">
          <CheckCircle2 size={18} />
          {message}
        </div>
      )}

      {!session ? (
        <section className="cash-panel opening-panel">
          <div className="panel-icon">
            <Unlock size={24} />
          </div>

          <h2>Buka Sesi Kas Hari Ini</h2>
          <p>
            Masukkan jumlah uang modal yang tersedia secara
            fisik di dalam laci kas sebelum transaksi dimulai.
          </p>

          <label>Modal Awal Kas</label>
          <div className="money-input">
            <span>Rp</span>
            <input
              type="number"
              min="0"
              value={openingAmount}
              onChange={(e) => setOpeningAmount(e.target.value)}
              placeholder="Contoh: 500000"
            />
          </div>

          <label>Catatan (opsional)</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Catatan pembukaan kas..."
            rows={3}
          />

          <button
            className="primary-button"
            onClick={openSession}
            disabled={busy}
          >
            <Unlock size={17} />
            {busy ? "Membuka sesi..." : "Buka Sesi Kas"}
          </button>
        </section>
      ) : (
        <>
          <section className="session-banner">
            <div className="session-status">
              {session.status === "open" ? (
                <Unlock size={20} />
              ) : (
                <Lock size={20} />
              )}
              <div>
                <strong>
                  {session.status === "open"
                    ? "Sesi Kas Sedang Berjalan"
                    : "Sesi Kas Sudah Ditutup"}
                </strong>
                <span>
                  Dibuka pada{" "}
                  {new Date(session.opened_at).toLocaleTimeString(
                    "id-ID",
                    {
                      hour: "2-digit",
                      minute: "2-digit",
                      timeZone: "Asia/Jakarta",
                    }
                  )}
                </span>
              </div>
            </div>

            <span
              className={
                session.status === "open"
                  ? "status-open"
                  : "status-closed"
              }
            >
              {session.status === "open" ? "OPEN" : "CLOSED"}
            </span>
          </section>

          <section className="summary-grid">
            <div className="summary-card">
              <span>Modal Awal</span>
              <strong>{rupiah(session.opening_cash)}</strong>
            </div>

            <div className="summary-card">
              <span>Penjualan Tunai</span>
              <strong>{rupiah(cashSales)}</strong>
            </div>

            <div className="summary-card">
              <span>Pembayaran Kulakan Tunai</span>
              <strong className="negative">
                - {rupiah(cashPurchases)}
              </strong>
            </div>

            <div className="summary-card">
              <span>Pengeluaran Tunai</span>
              <strong className="negative">
                - {rupiah(cashExpenses)}
              </strong>
            </div>
          </section>

          <section className="cash-panel expected-panel">
            <span>Saldo Kas yang Seharusnya</span>
            <strong>{rupiah(expectedCash)}</strong>
            <p>
              Modal awal + penjualan tunai - pembayaran
              kulakan tunai - pengeluaran tunai.
            </p>
          </section>

          {session.status === "open" ? (
            <section className="cash-panel closing-panel">
              <div className="panel-icon">
                <Lock size={24} />
              </div>

              <h2>Tutup Sesi Kas</h2>
              <p>
                Hitung seluruh uang fisik di laci kas, lalu
                masukkan jumlah akhirnya.
              </p>

              <label>Jumlah Uang Fisik</label>
              <div className="money-input">
                <span>Rp</span>
                <input
                  type="number"
                  min="0"
                  value={closingAmount}
                  onChange={(e) => setClosingAmount(e.target.value)}
                  placeholder="Masukkan hasil penghitungan"
                />
              </div>

              {closingAmount !== "" && (
                <div className="difference-box">
                  <span>Selisih Kas</span>
                  <strong
                    className={
                      difference === 0
                        ? "neutral"
                        : difference > 0
                        ? "positive"
                        : "negative"
                    }
                  >
                    {difference > 0 ? "+ " : ""}
                    {rupiah(difference)}
                  </strong>
                  <small>
                    {difference === 0
                      ? "Kas sesuai dengan perhitungan sistem."
                      : difference > 0
                      ? "Uang fisik lebih besar dari saldo sistem."
                      : "Terdapat kekurangan uang fisik."}
                  </small>
                </div>
              )}

              <button
                className="primary-button"
                onClick={closeSession}
                disabled={busy || closingAmount.trim() === ""}
              >
                <Lock size={17} />
                {busy ? "Menutup sesi..." : "Tutup Sesi Kas"}
              </button>
            </section>
          ) : (
            <section className="cash-panel closed-panel">
              <CheckCircle2 size={28} />
              <h2>Rekap Penutupan Kas</h2>

              <div className="closed-row">
                <span>Saldo seharusnya</span>
                <strong>
                  {rupiah(session.expected_closing_cash)}
                </strong>
              </div>

              <div className="closed-row">
                <span>Uang fisik</span>
                <strong>
                  {rupiah(Number(session.closing_cash_actual || 0))}
                </strong>
              </div>

              <div className="closed-row final-row">
                <span>Selisih kas</span>
                <strong>
                  {rupiah(Number(session.cash_difference || 0))}
                </strong>
              </div>

              <p>
                Sesi kas hari ini telah ditutup. Transaksi kasir
                tidak dapat dilanjutkan menggunakan sesi ini.
              </p>
            </section>
          )}
        </>
      )}

      <div className="refresh-row">
        <button onClick={loadData} disabled={busy}>
          <RefreshCw size={15} />
          Perbarui Data
        </button>
      </div>

      <style jsx>{`
        .cash-page {
          display: flex;
          flex-direction: column;
          gap: 20px;
          padding-bottom: 35px;
          color: #26352c;
          font-family: var(--font-dm-sans), sans-serif;
        }

        .cash-hero {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          padding: 30px;
          border: 1px solid #e5e9e1;
          border-radius: 18px;
          background: linear-gradient(120deg, #fff, #f3f7f1);
        }

        .eyebrow {
          color: #b99a62;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 2px;
        }

        h1 {
          margin: 9px 0;
          color: #103a2a;
          font-size: 30px;
          font-weight: 800;
        }

        .cash-hero p,
        .cash-panel p {
          color: #849087;
          font-size: 12px;
          line-height: 1.8;
        }

        .date-chip {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 11px 14px;
          border: 1px solid #e2e9df;
          border-radius: 10px;
          background: white;
          color: #45614d;
          font-size: 11px;
          white-space: nowrap;
        }

        .cash-panel {
          padding: 27px;
          border: 1px solid #e7ece5;
          border-radius: 17px;
          background: white;
          box-shadow: 0 5px 20px rgba(24,55,37,.035);
        }

        .opening-panel,
        .closing-panel {
          max-width: 650px;
        }

        .panel-icon {
          display: grid;
          place-items: center;
          width: 48px;
          height: 48px;
          margin-bottom: 17px;
          border-radius: 13px;
          background: #edf4ef;
          color: #174b36;
        }

        .cash-panel h2 {
          margin: 0 0 7px;
          color: #103a2a;
          font-size: 19px;
        }

        label {
          display: block;
          margin: 20px 0 8px;
          color: #526157;
          font-size: 11px;
          font-weight: 800;
        }

        .money-input {
          display: flex;
          align-items: center;
          gap: 10px;
          min-height: 49px;
          padding: 0 14px;
          border: 1px solid #dfe8df;
          border-radius: 10px;
          background: #fafcf9;
        }

        .money-input span {
          color: #78917e;
          font-weight: 800;
        }

        .money-input input {
          width: 100%;
          border: 0;
          outline: 0;
          background: transparent;
          color: #174b36;
          font-size: 16px;
          font-weight: 700;
        }

        textarea {
          width: 100%;
          box-sizing: border-box;
          padding: 12px;
          border: 1px solid #dfe8df;
          border-radius: 10px;
          outline: 0;
          font: inherit;
          font-size: 12px;
        }

        .primary-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
          min-height: 46px;
          margin-top: 20px;
          padding: 0 20px;
          border: 0;
          border-radius: 10px;
          background: #174b36;
          color: white;
          font-size: 12px;
          font-weight: 800;
          cursor: pointer;
        }

        .primary-button:disabled {
          opacity: .5;
          cursor: not-allowed;
        }

        .session-banner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 19px 22px;
          border: 1px solid #dce8de;
          border-radius: 14px;
          background: #f7faf6;
        }

        .session-status {
          display: flex;
          align-items: center;
          gap: 13px;
          color: #174b36;
        }

        .session-status strong,
        .session-status span {
          display: block;
        }

        .session-status strong {
          font-size: 13px;
        }

        .session-status span {
          margin-top: 5px;
          color: #849087;
          font-size: 10px;
        }

        .status-open,
        .status-closed {
          padding: 7px 11px;
          border-radius: 8px;
          background: #e5f2e7;
          color: #35764a;
          font-size: 10px;
          font-weight: 900;
        }

        .status-closed {
          background: #f0f1ef;
          color: #69736b;
        }

        .summary-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 13px;
        }

        .summary-card {
          padding: 19px;
          border: 1px solid #e7ece5;
          border-radius: 13px;
          background: white;
        }

        .summary-card span,
        .summary-card strong {
          display: block;
        }

        .summary-card span {
          color: #849087;
          font-size: 10px;
        }

        .summary-card strong {
          margin-top: 10px;
          color: #174b36;
          font-size: 17px;
        }

        .negative {
          color: #b34e4e !important;
        }

        .expected-panel {
          background: #f4f8f3;
        }

        .expected-panel > span {
          color: #718176;
          font-size: 12px;
          font-weight: 700;
        }

        .expected-panel > strong {
          display: block;
          margin-top: 8px;
          color: #174b36;
          font-size: 32px;
          font-weight: 900;
        }

        .difference-box {
          display: flex;
          flex-direction: column;
          gap: 6px;
          margin-top: 17px;
          padding: 17px;
          border: 1px solid #e7ece5;
          border-radius: 11px;
          background: #fafcf9;
        }

        .difference-box span,
        .difference-box small {
          color: #849087;
          font-size: 10px;
        }

        .difference-box strong {
          font-size: 21px;
        }

        .positive {
          color: #28784a;
        }

        .neutral {
          color: #174b36;
        }

        .closed-panel > svg {
          color: #368052;
        }

        .closed-row {
          display: flex;
          justify-content: space-between;
          gap: 15px;
          padding: 13px 0;
          border-bottom: 1px solid #edf0eb;
          font-size: 12px;
        }

        .closed-row span {
          color: #849087;
        }

        .final-row strong {
          color: #174b36;
        }

        .alert {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 13px 15px;
          border-radius: 10px;
          font-size: 12px;
        }

        .error {
          background: #fff0ef;
          color: #a33c35;
        }

        .success {
          background: #edf7ee;
          color: #347548;
        }

        .refresh-row {
          display: flex;
          justify-content: flex-end;
        }

        .refresh-row button {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 14px;
          border: 1px solid #e1e9df;
          border-radius: 9px;
          background: white;
          color: #45614d;
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
        }

        .cash-loading {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 40px;
          color: #45614d;
        }

        .spin {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        @media (max-width: 850px) {
          .summary-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 600px) {
          .cash-hero {
            align-items: flex-start;
            flex-direction: column;
            padding: 22px;
          }

          h1 {
            font-size: 25px;
          }

          .summary-grid {
            grid-template-columns: 1fr 1fr;
          }

          .summary-card {
            padding: 14px;
          }

          .summary-card strong {
            font-size: 14px;
          }

          .cash-panel {
            padding: 20px;
          }

          .expected-panel > strong {
            font-size: 25px;
          }
        }
      `}</style>
    </main>
  );
}
