
"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";

type Sale = {
  id: string;
  receipt_number: string;
  subtotal: number;
  discount: number;
  total: number;
  payment_method: string;
  amount_paid: number;
  change_amount: number;
  status: string;
  created_at: string;
  cashier_id: string;
};

type SaleItem = {
  sale_id: string;
  product_name_snapshot: string;
  brand_snapshot: string | null;
  quantity: number;
  selling_price_snapshot: number;
  purchase_cost_snapshot: number;
  line_total: number;
  gross_profit_snapshot: number;
};

type Intake = {
  id: string;
  purchase_date: string;
  quantity_received: number;
  purchase_price: number;
  status: string;
};

type AuditLog = {
  id: string;
  action: string;
  entity_type: string;
  details: Record<string, unknown> | null;
  created_at: string;
  actor_id: string | null;
};

const money = (value: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value || 0);

const dateValue = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export default function LaporanPage() {
  const supabase = createClient();

  const today = dateValue(new Date());
  const firstDay = dateValue(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  );

  const [startDate, setStartDate] = useState(firstDay);
  const [endDate, setEndDate] = useState(today);
  const [sales, setSales] = useState<Sale[]>([]);
  const [items, setItems] = useState<SaleItem[]>([]);
  const [intakes, setIntakes] = useState<Intake[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [accessDenied, setAccessDenied] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "penjualan" | "kulakan" | "aktivitas"
  >("penjualan");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    setAccessDenied(false);

    try {
      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError || !authData.user) {
        window.location.replace("/login");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role,is_active")
        .eq("id", authData.user.id)
        .single();

      if (
        profileError ||
        !profile ||
        !profile.is_active ||
        profile.role !== "admin"
      ) {
        setAccessDenied(true);
        return;
      }

      if (!startDate || !endDate || startDate > endDate) {
        setError("Rentang tanggal tidak valid.");
        return;
      }

      const start = new Date(`${startDate}T00:00:00`).toISOString();
      const endExclusive = new Date(
        new Date(`${endDate}T00:00:00`).getTime() + 86400000
      ).toISOString();

      const [
        salesResult,
        intakesResult,
        logsResult,
        profilesResult,
      ] = await Promise.all([
        supabase
          .from("sales")
          .select(
            "id,receipt_number,subtotal,discount,total,payment_method,amount_paid,change_amount,status,created_at,cashier_id"
          )
          .gte("created_at", start)
          .lt("created_at", endExclusive)
          .order("created_at", { ascending: false }),

        supabase
          .from("purchase_intakes")
          .select(
            "id,purchase_date,quantity_received,purchase_price,status"
          )
          .gte("purchase_date", startDate)
          .lte("purchase_date", endDate)
          .order("purchase_date", { ascending: false }),

        supabase
          .from("audit_logs")
          .select("id,action,entity_type,details,created_at,actor_id")
          .gte("created_at", start)
          .lt("created_at", endExclusive)
          .order("created_at", { ascending: false })
          .limit(200),

        supabase
          .from("profiles")
          .select("id,full_name,username"),
      ]);

      const queryError =
        salesResult.error ||
        intakesResult.error ||
        logsResult.error ||
        profilesResult.error;

      if (queryError) {
        throw new Error(queryError.message);
      }

      const salesData = (salesResult.data || []) as Sale[];
      setSales(salesData);
      setIntakes((intakesResult.data || []) as Intake[]);
      setLogs((logsResult.data || []) as AuditLog[]);

      const profileMap: Record<string, string> = {};
      for (const p of profilesResult.data || []) {
        profileMap[p.id] = p.full_name || p.username || p.id;
      }
      setProfiles(profileMap);

      if (salesData.length > 0) {
        const { data: itemData, error: itemError } = await supabase
          .from("sale_items")
          .select(
            "sale_id,product_name_snapshot,brand_snapshot,quantity,selling_price_snapshot,purchase_cost_snapshot,line_total,gross_profit_snapshot"
          )
          .in(
            "sale_id",
            salesData.map((sale) => sale.id)
          );

        if (itemError) throw new Error(itemError.message);
        setItems((itemData || []) as SaleItem[]);
      } else {
        setItems([]);
      }
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Gagal memuat laporan."
      );
    } finally {
      setLoading(false);
    }
  }, [supabase, startDate, endDate]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const completedSales = sales.filter(
    (sale) => sale.status === "completed"
  );

  const omzet = completedSales.reduce(
    (sum, sale) => sum + Number(sale.total || 0),
    0
  );

  const keuntungan = items
    .filter((item) =>
      completedSales.some((sale) => sale.id === item.sale_id)
    )
    .reduce(
      (sum, item) => sum + Number(item.gross_profit_snapshot || 0),
      0
    );

  const totalKulakan = intakes
    .filter((intake) => intake.status === "approved")
    .reduce(
      (sum, intake) =>
        sum +
        Number(intake.purchase_price || 0) *
          Number(intake.quantity_received || 0),
      0
    );

  const totalItem = items
    .filter((item) =>
      completedSales.some((sale) => sale.id === item.sale_id)
    )
    .reduce((sum, item) => sum + Number(item.quantity || 0), 0);

  const exportCsv = () => {
    const rows = [
      [
        "No Struk",
        "Tanggal",
        "Kasir",
        "Metode Pembayaran",
        "Subtotal",
        "Diskon",
        "Total",
        "Status",
      ],
      ...sales.map((sale) => [
        sale.receipt_number,
        new Date(sale.created_at).toLocaleString("id-ID"),
        profiles[sale.cashier_id] || sale.cashier_id,
        sale.payment_method,
        sale.subtotal,
        sale.discount,
        sale.total,
        sale.status,
      ]),
    ];

    const csv = rows
      .map((row) =>
        row
          .map((cell) => {
            const value = String(cell ?? "");
            return `"${value.replace(/"/g, '""')}"`;
          })
          .join(",")
      )
      .join("\r\n");

    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `laporan-penjualan-${startDate}-${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (accessDenied) {
    return (
      <main className="mx-auto max-w-5xl p-6">
        <h1 className="text-2xl font-bold">Akses ditolak</h1>
        <p className="mt-2 text-gray-600">
          Halaman laporan hanya dapat diakses admin.
        </p>
        <a className="mt-4 inline-block underline" href="/dashboard">
          Kembali ke dashboard
        </a>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Laporan Toko Rosyidah</h1>
          <p className="text-sm text-gray-500">
            Penjualan, keuntungan, kulakan, dan aktivitas pengguna.
          </p>
        </div>
        <a
          href="/dashboard"
          className="rounded-lg border px-4 py-2 text-sm"
        >
          Kembali
        </a>
      </header>

      <section className="flex flex-wrap items-end gap-3 rounded-xl border p-4">
        <label className="grid gap-1 text-sm">
          Tanggal awal
          <input
            type="date"
            value={startDate}
            max={endDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="rounded-lg border p-2"
          />
        </label>

        <label className="grid gap-1 text-sm">
          Tanggal akhir
          <input
            type="date"
            value={endDate}
            min={startDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="rounded-lg border p-2"
          />
        </label>

        <button
          onClick={() => void loadData()}
          disabled={loading}
          className="rounded-lg bg-black px-4 py-2 text-white disabled:opacity-50"
        >
          {loading ? "Memuat..." : "Muat ulang"}
        </button>

        <button
          onClick={exportCsv}
          disabled={loading || sales.length === 0}
          className="rounded-lg border px-4 py-2 disabled:opacity-50"
        >
          Ekspor CSV
        </button>
      </section>

      {error && (
        <div className="rounded-lg border border-red-300 p-4 text-red-700">
          <p className="font-semibold">Gagal memuat laporan</p>
          <p className="break-words text-sm">{error}</p>
          <p className="mt-2 text-sm">
            Periksa apakah tabel dan kebijakan akses Supabase sudah tersedia.
          </p>
        </div>
      )}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            title: "Omzet Penjualan",
            value: money(omzet),
          },
          {
            title: "Keuntungan Kotor",
            value: money(keuntungan),
          },
          {
            title: "Transaksi Selesai",
            value: String(completedSales.length),
          },
          {
            title: "Barang Terjual",
            value: `${totalItem} unit`,
          },
          {
            title: "Belanja Kulakan Disetujui",
            value: money(totalKulakan),
          },
        ].map((card) => (
          <article
            key={card.title}
            className="rounded-xl border p-5"
          >
            <p className="text-sm text-gray-500">{card.title}</p>
            <p className="mt-2 break-words text-xl font-bold">
              {card.value}
            </p>
          </article>
        ))}
      </section>

      <nav className="flex flex-wrap gap-2">
        {[
          ["penjualan", "Penjualan"],
          ["kulakan", "Riwayat Kulakan"],
          ["aktivitas", "Riwayat Aktivitas"],
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() =>
              setActiveTab(
                key as "penjualan" | "kulakan" | "aktivitas"
              )
            }
            className={`rounded-lg px-4 py-2 text-sm ${
              activeTab === key
                ? "bg-black text-white"
                : "border"
            }`}
          >
            {label}
          </button>
        ))}
      </nav>

      {loading ? (
        <p className="py-8 text-center text-gray-500">
          Memuat data laporan...
        </p>
      ) : (
        <>
          {activeTab === "penjualan" && (
            <section className="overflow-x-auto rounded-xl border">
              <div className="border-b p-4">
                <h2 className="font-semibold">Daftar Transaksi</h2>
                <p className="text-sm text-gray-500">
                  Keuntungan dihitung dari snapshot transaksi yang selesai.
                </p>
              </div>

              <table className="w-full min-w-[850px] text-left text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="p-3">Tanggal</th>
                    <th className="p-3">No. Struk</th>
                    <th className="p-3">Kasir</th>
                    <th className="p-3">Pembayaran</th>
                    <th className="p-3">Total</th>
                    <th className="p-3">Keuntungan</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.map((sale) => {
                    const profit = items
                      .filter((item) => item.sale_id === sale.id)
                      .reduce(
                        (sum, item) =>
                          sum +
                          Number(item.gross_profit_snapshot || 0),
                        0
                      );

                    return (
                      <tr key={sale.id} className="border-t">
                        <td className="p-3">
                          {new Date(sale.created_at).toLocaleString(
                            "id-ID"
                          )}
                        </td>
                        <td className="p-3 font-medium">
                          {sale.receipt_number}
                        </td>
                        <td className="p-3">
                          {profiles[sale.cashier_id] ||
                            sale.cashier_id}
                        </td>
                        <td className="p-3 uppercase">
                          {sale.payment_method}
                        </td>
                        <td className="p-3">{money(sale.total)}</td>
                        <td className="p-3">
                          {sale.status === "completed"
                            ? money(profit)
                            : "-"}
                        </td>
                        <td className="p-3">{sale.status}</td>
                      </tr>
                    );
                  })}
                  {sales.length === 0 && (
                    <tr>
                      <td
                        colSpan={7}
                        className="p-8 text-center text-gray-500"
                      >
                        Belum ada transaksi pada periode ini.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </section>
          )}

          {activeTab === "kulakan" && (
            <section className="overflow-x-auto rounded-xl border">
              <div className="border-b p-4">
                <h2 className="font-semibold">Riwayat Kulakan</h2>
                <p className="text-sm text-gray-500">
                  Total belanja kartu ringkasan hanya menghitung kulakan
                  yang disetujui.
                </p>
              </div>

              <table className="w-full min-w-[650px] text-left text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="p-3">Tanggal</th>
                    <th className="p-3">Jumlah</th>
                    <th className="p-3">Harga Kulakan/Unit</th>
                    <th className="p-3">Total</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {intakes.map((intake) => (
                    <tr key={intake.id} className="border-t">
                      <td className="p-3">
                        {intake.purchase_date}
                      </td>
                      <td className="p-3">
                        {intake.quantity_received}
                      </td>
                      <td className="p-3">
                        {money(intake.purchase_price)}
                      </td>
                      <td className="p-3">
                        {money(
                          Number(intake.quantity_received) *
                            Number(intake.purchase_price)
                        )}
                      </td>
                      <td className="p-3">{intake.status}</td>
                    </tr>
                  ))}
                  {intakes.length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="p-8 text-center text-gray-500"
                      >
                        Belum ada data kulakan pada periode ini.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </section>
          )}

          {activeTab === "aktivitas" && (
            <section className="overflow-x-auto rounded-xl border">
              <div className="border-b p-4">
                <h2 className="font-semibold">Riwayat Aktivitas</h2>
                <p className="text-sm text-gray-500">
                  Maksimal 200 aktivitas terbaru pada rentang tanggal.
                </p>
              </div>

              <table className="w-full min-w-[650px] text-left text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="p-3">Waktu</th>
                    <th className="p-3">Pengguna</th>
                    <th className="p-3">Aktivitas</th>
                    <th className="p-3">Jenis Data</th>
                    <th className="p-3">Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="border-t">
                      <td className="p-3">
                        {new Date(log.created_at).toLocaleString(
                          "id-ID"
                        )}
                      </td>
                      <td className="p-3">
                        {log.actor_id
                          ? profiles[log.actor_id] || log.actor_id
                          : "-"}
                      </td>
                      <td className="p-3">{log.action}</td>
                      <td className="p-3">{log.entity_type}</td>
                      <td className="max-w-xs p-3">
                        <pre className="whitespace-pre-wrap break-words text-xs">
                          {JSON.stringify(log.details || {}, null, 2)}
                        </pre>
                      </td>
                    </tr>
                  ))}
                  {logs.length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="p-8 text-center text-gray-500"
                      >
                        Belum ada catatan aktivitas pada periode ini.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </section>
          )}
        </>
      )}
    </main>
  );
}
