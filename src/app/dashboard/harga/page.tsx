
"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";

type Intake = {
  id: string;
  product_id: string;
  purchase_date: string;
  quantity_received: number;
  purchase_price: number;
  created_at: string;
};

type Product = {
  id: string;
  name: string;
  brand: string;
};

type Notice = {
  id: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
};

const rupiah = (value: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

export default function HargaPage() {
  const [supabase] = useState(() => createClient());
  const [intakes, setIntakes] = useState<Intake[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [percentages, setPercentages] = useState<Record<string, string>>({});
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) {
        throw new Error(`Gagal memeriksa sesi: ${authError.message}`);
      }

      if (!user) {
        window.location.replace("/login");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role, is_active")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) {
        throw new Error(`Gagal membaca profil: ${profileError.message}`);
      }

      if (!profile) {
        setIsAdmin(false);
        throw new Error(
          `Profil tidak ditemukan untuk akun login: ${user.id}`
        );
      }

      if (profile.role !== "admin" || profile.is_active !== true) {
        setIsAdmin(false);
        throw new Error(
          `Akses admin ditolak. Role: ${profile.role}; aktif: ${String(profile.is_active)}`
        );
      }

      setIsAdmin(true);

      const [
        intakesResult,
        productsResult,
        noticesResult,
      ] = await Promise.all([
        supabase
          .from("purchase_intakes")
          .select(
            "id,product_id,purchase_date,quantity_received,purchase_price,created_at"
          )
          .eq("status", "pending_price")
          .order("created_at", { ascending: true }),

        supabase
          .from("products")
          .select("id,name,brand"),

        supabase
          .from("notifications")
          .select("id,title,message,is_read,created_at")
          .eq("recipient_role", "admin")
          .order("created_at", { ascending: false })
          .limit(50),
      ]);

      if (intakesResult.error) {
        throw new Error(`Gagal memuat kulakan: ${intakesResult.error.message}`);
      }

      if (productsResult.error) {
        throw new Error(`Gagal memuat barang: ${productsResult.error.message}`);
      }

      if (noticesResult.error) {
        throw new Error(
          `Gagal memuat notifikasi: ${noticesResult.error.message}`
        );
      }

      setIntakes((intakesResult.data || []) as Intake[]);
      setProducts((productsResult.data || []) as Product[]);
      setNotices((noticesResult.data || []) as Notice[]);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Terjadi kesalahan saat memuat data."
      );
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function approve(intake: Intake) {
    const rawPercentage = percentages[intake.id];

    if (rawPercentage === undefined || rawPercentage.trim() === "") {
      setError("Masukkan persentase markup terlebih dahulu.");
      return;
    }

    const percentage = Number(rawPercentage);

    if (
      !Number.isFinite(percentage) ||
      percentage < 0 ||
      percentage > 1000
    ) {
      setError("Markup harus antara 0 sampai 1000 persen.");
      return;
    }

    setBusyId(intake.id);
    setError("");
    setMessage("");

    try {
      const { data, error: rpcError } = await supabase.rpc(
        "approve_purchase_intake",
        {
          p_intake_id: intake.id,
          p_profit_percent: percentage,
        }
      );

      if (rpcError) throw new Error(rpcError.message);

      if (!data || data.success !== true) {
        throw new Error("Persetujuan harga tidak berhasil.");
      }

      setMessage(
        `Harga berhasil disetujui. Harga jual: ${rupiah(Number(data.selling_price))}`
      );

      setPercentages((old) => {
        const next = { ...old };
        delete next[intake.id];
        return next;
      });

      await loadData();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Gagal menyetujui harga."
      );
    } finally {
      setBusyId("");
    }
  }

  if (loading) {
    return (
      <main style={{ padding: 24 }}>
        <p>Memeriksa akses admin dan memuat data...</p>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main style={{ padding: 24 }}>
        <h1>Akses ditolak</h1>
        <p>{error || "Halaman ini hanya untuk admin aktif."}</p>
        <button onClick={() => void loadData()}>
          Coba lagi
        </button>{" "}
        <a href="/dashboard">Kembali ke dashboard</a>
      </main>
    );
  }

  return (
    <main
      style={{
        maxWidth: 1100,
        margin: "0 auto",
        padding: 24,
        color: "#17211b",
      }}
    >
      <a href="/dashboard">← Kembali ke dashboard</a>

      <h1 style={{ marginBottom: 4 }}>Persetujuan Harga</h1>
      <p>TOKO ROSYIDAH — Pasar Sebaung</p>
      <p>Persentase keuntungan ditetapkan per barang berdasarkan harga kulakan.</p>

      {error && (
        <p
          role="alert"
          style={{
            padding: 12,
            background: "#fff0f0",
            color: "#b42318",
            borderRadius: 8,
          }}
        >
          {error}
        </p>
      )}

      {message && (
        <p
          role="status"
          style={{
            padding: 12,
            background: "#edf7ef",
            color: "#176b45",
            borderRadius: 8,
          }}
        >
          {message}
        </p>
      )}

      <button
        type="button"
        onClick={() => void loadData()}
        disabled={loading}
        style={{
          padding: "9px 14px",
          border: "1px solid #ccc",
          borderRadius: 8,
          background: "white",
        }}
      >
        Muat ulang data
      </button>

      <h2>Menunggu Persetujuan ({intakes.length})</h2>

      {intakes.length === 0 ? (
        <p>Tidak ada kulakan yang menunggu persetujuan harga.</p>
      ) : (
        <div style={{ display: "grid", gap: 16 }}>
          {intakes.map((intake) => {
            const product = products.find(
              (p) => p.id === intake.product_id
            );

            const rawPercentage = percentages[intake.id] ?? "";
            const percentage = Number(rawPercentage);

            const hasPercentage =
              rawPercentage.trim() !== "" &&
              Number.isFinite(percentage) &&
              percentage >= 0 &&
              percentage <= 1000;

            const estimatedPrice = hasPercentage
              ? Math.round(
                  Number(intake.purchase_price) *
                    (1 + percentage / 100)
                )
              : null;

            return (
              <article
                key={intake.id}
                style={{
                  background: "white",
                  padding: 20,
                  border: "1px solid #e1e8e3",
                  borderRadius: 12,
                }}
              >
                <h3>
                  {product?.name || "Barang"} — {product?.brand || "-"}
                </h3>

                <p>Tanggal kulakan: {intake.purchase_date}</p>
                <p>Jumlah: {intake.quantity_received}</p>
                <p>
                  Harga kulakan per unit:{" "}
                  <strong>{rupiah(intake.purchase_price)}</strong>
                </p>

                <label
                  htmlFor={`percent-${intake.id}`}
                  style={{ display: "block", marginBottom: 6 }}
                >
                  Persentase markup (%)
                </label>

                <input
                  id={`percent-${intake.id}`}
                  type="number"
                  min="0"
                  max="1000"
                  step="0.1"
                  placeholder="Contoh: 20"
                  value={rawPercentage}
                  onChange={(e) =>
                    setPercentages((old) => ({
                      ...old,
                      [intake.id]: e.target.value,
                    }))
                  }
                  style={{
                    padding: 10,
                    width: 180,
                    border: "1px solid #ccc",
                    borderRadius: 8,
                  }}
                />

                <p>
                  Perkiraan harga jual:{" "}
                  <strong>
                    {estimatedPrice === null
                      ? "Masukkan persentase"
                      : rupiah(estimatedPrice)}
                  </strong>
                </p>

                <button
                  type="button"
                  disabled={busyId !== "" || !hasPercentage}
                  onClick={() => void approve(intake)}
                  style={{
                    padding: "11px 18px",
                    border: 0,
                    borderRadius: 8,
                    background: "#176b45",
                    color: "white",
                    cursor: "pointer",
                    opacity:
                      busyId !== "" || !hasPercentage ? 0.6 : 1,
                  }}
                >
                  {busyId === intake.id
                    ? "Memproses..."
                    : "Setujui Harga"}
                </button>
              </article>
            );
          })}
        </div>
      )}

      <h2 style={{ marginTop: 36 }}>Notifikasi Admin</h2>

      {notices.length === 0 ? (
        <p>Belum ada notifikasi.</p>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {notices.map((notice) => (
            <article
              key={notice.id}
              style={{
                padding: 14,
                border: "1px solid #e1e8e3",
                borderRadius: 10,
                background: notice.is_read ? "white" : "#edf7ef",
              }}
            >
              <strong>{notice.title}</strong>
              <p>{notice.message}</p>
              <small>
                {new Date(notice.created_at).toLocaleString("id-ID")}
              </small>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
