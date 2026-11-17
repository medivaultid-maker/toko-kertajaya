
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase";
import {
  ArrowLeft,
  RefreshCw,
  Package,
  Clock3,
  Boxes,
  Wallet,
  CheckCircle2,
  AlertCircle,
  X,
  CalendarDays,
  TrendingUp,
  Calculator,
  BadgeCheck,
  LoaderCircle,
  Sparkles,
  Tag,
  Receipt,
  ShieldCheck,
} from "lucide-react";

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

type ProfitType = "percent" | "nominal";

type ProfitSetting = {
  type: ProfitType;
  value: string;
};

const rupiah = (value: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const dateFormat = (value: string) =>
  new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

export default function HargaPage() {
  const [supabase] = useState(() => createClient());

  const [intakes, setIntakes] = useState<Intake[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  const [profitSettings, setProfitSettings] = useState<
    Record<string, ProfitSetting>
  >({});

  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const productMap = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products]
  );

  const totalUnits = intakes.reduce(
    (total, item) => total + Number(item.quantity_received || 0),
    0
  );

  const totalCapital = intakes.reduce(
    (total, item) =>
      total +
      Number(item.quantity_received || 0) *
        Number(item.purchase_price || 0),
    0
  );

  const getSetting = (intakeId: string): ProfitSetting =>
    profitSettings[intakeId] || {
      type: "percent",
      value: "",
    };

  const updateSetting = (
    intakeId: string,
    updates: Partial<ProfitSetting>
  ) => {
    setProfitSettings((old) => ({
      ...old,
      [intakeId]: {
        ...getSetting(intakeId),
        ...updates,
      },
    }));
  };

  const loadData = useCallback(
    async (showLoading = true) => {
      if (showLoading) setLoading(true);

      setError("");

      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError) throw new Error(authError.message);

        if (!user) {
          window.location.replace("/login");
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("role, is_active")
          .eq("id", user.id)
          .maybeSingle();

        if (profileError) throw new Error(profileError.message);

        if (!profile) {
          setIsAdmin(false);
          throw new Error("Profil pengguna tidak ditemukan.");
        }

        if (
          !["admin", "owner"].includes(profile.role) ||
          profile.is_active !== true
        ) {
          setIsAdmin(false);
          throw new Error("Akses hanya untuk pemilik atau admin aktif.");
        }

        setIsAdmin(true);

        const [intakesResult, productsResult] = await Promise.all([
          supabase
            .from("purchase_intakes")
            .select(
              "id,product_id,purchase_date,quantity_received,purchase_price,created_at"
            )
            .eq("status", "pending_price")
            .order("created_at", { ascending: true }),

          supabase.from("products").select("id,name,brand"),
        ]);

        if (intakesResult.error) {
          throw new Error(intakesResult.error.message);
        }

        if (productsResult.error) {
          throw new Error(productsResult.error.message);
        }

        setIntakes((intakesResult.data || []) as Intake[]);
        setProducts((productsResult.data || []) as Product[]);
      } catch (e) {
        setError(
          e instanceof Error
            ? e.message
            : "Terjadi kesalahan saat memuat data."
        );
      } finally {
        if (showLoading) setLoading(false);
      }
    },
    [supabase]
  );

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function approve(intake: Intake) {
    const setting = getSetting(intake.id);
    const rawValue = setting.value;

    if (rawValue.trim() === "") {
      setError("Masukkan nilai keuntungan terlebih dahulu.");
      return;
    }

    const profitValue = Number(rawValue);

    if (!Number.isFinite(profitValue) || profitValue < 0) {
      setError("Nilai keuntungan harus berupa angka nol atau lebih.");
      return;
    }

    if (setting.type === "percent" && profitValue > 1000) {
      setError("Persentase keuntungan maksimal 1000%.");
      return;
    }

    if (setting.type === "nominal" && profitValue > 1000000000) {
      setError("Nominal keuntungan terlalu besar.");
      return;
    }

    if (Number(intake.purchase_price) <= 0) {
      setError("Harga kulakan harus lebih besar dari nol.");
      return;
    }

    setBusyId(intake.id);
    setError("");
    setMessage("");

    try {
      const { data, error: rpcError } = await supabase.rpc(
        "finalize_purchase_intake",
        {
          p_intake_id: intake.id,
          p_profit_type: setting.type,
          p_profit_value: profitValue,
        }
      );

      if (rpcError) throw new Error(rpcError.message);

      if (!data || data.success !== true) {
        throw new Error("Persetujuan harga tidak berhasil.");
      }

      const methodLabel =
        setting.type === "percent"
          ? `${profitValue}%`
          : rupiah(profitValue);

      setMessage(
        `Harga berhasil disetujui. Keuntungan ${methodLabel}. Harga jual: ${rupiah(
          Number(data.selling_price)
        )}. Stok sekarang: ${Number(data.stock_quantity).toLocaleString(
          "id-ID"
        )} unit.`
      );

      setProfitSettings((old) => {
        const next = { ...old };
        delete next[intake.id];
        return next;
      });

      await loadData(false);
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
      <main className="price-loading">
        <div className="price-loading-icon">
          <LoaderCircle size={27} className="price-spin" />
        </div>
        <p>Menyiapkan persetujuan harga...</p>
        <span>Mohon tunggu sebentar</span>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="price-denied">
        <div className="price-denied-card">
          <div className="price-denied-icon">
            <ShieldCheck size={28} />
          </div>
          <h1>Akses dibatasi</h1>
          <p>{error || "Halaman ini hanya untuk pemilik atau admin aktif."}</p>
          <button
            className="price-button price-button-primary"
            onClick={() => void loadData()}
          >
            <RefreshCw size={16} />
            Coba lagi
          </button>
          <a href="/dashboard" className="price-back-link">
            <ArrowLeft size={15} />
            Kembali ke dashboard
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="price-page">
      <div className="price-container">
        <a href="/dashboard" className="price-back-link">
          <ArrowLeft size={16} />
          Kembali ke Dashboard
        </a>

        {/* HEADER */}
        <header className="price-header">
          <div className="price-header-content">
            <div className="price-eyebrow">
              <Sparkles size={13} />
              TOKO ROSYIDAH · ADMINISTRATION
            </div>

            <h1>Persetujuan Harga</h1>

            <p>
              Tetapkan keuntungan dan kelola harga jual setiap barang
              kulakan.
            </p>
          </div>

          <button
            type="button"
            className="price-button price-button-outline"
            onClick={() => void loadData()}
            disabled={loading}
          >
            <RefreshCw size={16} />
            Muat Ulang
          </button>
        </header>

        {/* ALERTS */}
        {error && (
          <div className="price-alert price-alert-error" role="alert">
            <AlertCircle size={19} />
            <div>
              <strong>Terjadi kendala</strong>
              <p>{error}</p>
            </div>
            <button
              type="button"
              onClick={() => setError("")}
              aria-label="Tutup"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {message && (
          <div className="price-alert price-alert-success" role="status">
            <CheckCircle2 size={19} />
            <div>
              <strong>Berhasil</strong>
              <p>{message}</p>
            </div>
            <button
              type="button"
              onClick={() => setMessage("")}
              aria-label="Tutup"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* SUMMARY */}
        <section className="price-summary-grid">
          <article className="price-summary-card">
            <div className="price-summary-top">
              <span>Menunggu Persetujuan</span>
              <div className="price-summary-icon price-icon-emerald">
                <Clock3 size={20} />
              </div>
            </div>
            <strong>{intakes.length.toLocaleString("id-ID")}</strong>
            <small>Data kulakan menunggu</small>
          </article>

          <article className="price-summary-card">
            <div className="price-summary-top">
              <span>Total Unit Kulakan</span>
              <div className="price-summary-icon price-icon-gold">
                <Boxes size={20} />
              </div>
            </div>
            <strong>{totalUnits.toLocaleString("id-ID")}</strong>
            <small>Unit barang masuk</small>
          </article>

          <article className="price-summary-card price-summary-capital">
            <div className="price-summary-top">
              <span>Total Modal Kulakan</span>
              <div className="price-summary-icon price-icon-ivory">
                <Wallet size={20} />
              </div>
            </div>
            <strong>{rupiah(totalCapital)}</strong>
            <small>Akumulasi nilai pembelian</small>
          </article>
        </section>

        {/* PENDING LIST */}
        <section className="price-section">
          <div className="price-section-heading">
            <div>
              <div className="price-section-eyebrow">
                <Receipt size={13} />
                PRICE MANAGEMENT
              </div>
              <h2>Barang Menunggu Harga</h2>
              <p>
                Tentukan keuntungan untuk setiap barang menggunakan
                persentase atau nominal rupiah.
              </p>
            </div>

            <span className="price-pending-count">
              <span />
              {intakes.length} menunggu
            </span>
          </div>

          {/* EMPTY */}
          {intakes.length === 0 ? (
            <div className="price-empty">
              <div className="price-empty-icon">
                <BadgeCheck size={32} />
              </div>
              <h3>Semua harga sudah ditetapkan</h3>
              <p>
                Belum ada barang kulakan yang menunggu persetujuan harga.
              </p>
            </div>
          ) : (
            <div className="price-list">
              {intakes.map((intake) => {
                const product = productMap.get(intake.product_id);
                const setting = getSetting(intake.id);

                const rawValue = setting.value;
                const profitValue = Number(rawValue);

                const hasValue =
                  rawValue.trim() !== "" &&
                  Number.isFinite(profitValue) &&
                  profitValue >= 0 &&
                  (setting.type !== "percent" || profitValue <= 1000);

                const purchasePrice = Number(intake.purchase_price || 0);
                const quantity = Number(intake.quantity_received || 0);

                const estimatedPrice = hasValue
                  ? setting.type === "percent"
                    ? Math.round(
                        purchasePrice * (1 + profitValue / 100)
                      )
                    : Math.round(purchasePrice + profitValue)
                  : null;

                const profit =
                  estimatedPrice !== null
                    ? estimatedPrice - purchasePrice
                    : null;

                const isBusy = busyId === intake.id;

                return (
                  <article className="price-item-card" key={intake.id}>
                    {/* PRODUCT TITLE */}
                    <div className="price-item-header">
                      <div className="price-item-identity">
                        <div className="price-product-icon">
                          <Package size={22} />
                        </div>
                        <div>
                          <span className="price-item-overline">
                            DETAIL BARANG KULAKAN
                          </span>
                          <h3>{product?.name || "Barang tidak ditemukan"}</h3>
                          <p>
                            <Tag size={13} />
                            {product?.brand || "Merek tidak tersedia"}
                          </p>
                        </div>
                      </div>

                      <span className="price-status">
                        <span />
                        Menunggu harga
                      </span>
                    </div>

                    {/* PURCHASE DETAILS */}
                    <div className="price-detail-grid">
                      <div className="price-detail">
                        <span>Harga kulakan / unit</span>
                        <strong>{rupiah(purchasePrice)}</strong>
                      </div>

                      <div className="price-detail">
                        <span>Jumlah kulakan</span>
                        <strong>
                          {quantity.toLocaleString("id-ID")} unit
                        </strong>
                      </div>

                      <div className="price-detail">
                        <span>Tanggal kulakan</span>
                        <strong>
                          <CalendarDays size={14} />
                          {dateFormat(intake.purchase_date)}
                        </strong>
                      </div>

                      <div className="price-detail">
                        <span>Total modal barang</span>
                        <strong className="price-detail-total">
                          {rupiah(purchasePrice * quantity)}
                        </strong>
                      </div>
                    </div>

                    {/* PRICE SETTING */}
                    <div className="price-setting-grid">
                      <div className="price-markup-panel">
                        <div className="price-panel-heading">
                          <div className="price-panel-icon">
                            <TrendingUp size={18} />
                          </div>
                          <div>
                            <h4>Tentukan Keuntungan</h4>
                            <p>
                              Pilih metode keuntungan untuk barang ini.
                            </p>
                          </div>
                        </div>

                        {/* PROFIT TYPE */}
                        <div className="price-profit-type">
                          <button
                            type="button"
                            className={
                              setting.type === "percent"
                                ? "price-profit-type-button active"
                                : "price-profit-type-button"
                            }
                            onClick={() =>
                              updateSetting(intake.id, {
                                type: "percent",
                                value: "",
                              })
                            }
                            disabled={isBusy}
                          >
                            Persentase (%)
                          </button>

                          <button
                            type="button"
                            className={
                              setting.type === "nominal"
                                ? "price-profit-type-button active"
                                : "price-profit-type-button"
                            }
                            onClick={() =>
                              updateSetting(intake.id, {
                                type: "nominal",
                                value: "",
                              })
                            }
                            disabled={isBusy}
                          >
                            Nominal (Rp)
                          </button>
                        </div>

                        <label htmlFor={`profit-${intake.id}`}>
                          {setting.type === "percent"
                            ? "Persentase keuntungan"
                            : "Nominal keuntungan per unit"}
                        </label>

                        <div className="price-percent-input">
                          {setting.type === "nominal" && (
                            <span>Rp</span>
                          )}

                          <input
                            id={`profit-${intake.id}`}
                            type="number"
                            min="0"
                            max={
                              setting.type === "percent"
                                ? "1000"
                                : "1000000000"
                            }
                            step={
                              setting.type === "percent" ? "0.1" : "100"
                            }
                            placeholder={
                              setting.type === "percent"
                                ? "Contoh: 20"
                                : "Contoh: 5000"
                            }
                            value={rawValue}
                            onChange={(e) =>
                              updateSetting(intake.id, {
                                value: e.target.value,
                              })
                            }
                            disabled={isBusy}
                          />

                          {setting.type === "percent" && <span>%</span>}
                        </div>

                        <small>
                          {setting.type === "percent"
                            ? "Keuntungan dihitung berdasarkan persentase dari harga kulakan."
                            : "Nominal keuntungan ditambahkan langsung ke harga kulakan setiap unit."}
                        </small>
                      </div>

                      {/* PRICE PREVIEW */}
                      <div className="price-preview-panel">
                        <div className="price-preview-heading">
                          <Calculator size={17} />
                          ESTIMASI HARGA JUAL / UNIT
                        </div>

                        <strong className="price-preview-value">
                          {estimatedPrice === null
                            ? "Rp —"
                            : rupiah(estimatedPrice)}
                        </strong>

                        <div className="price-preview-divider" />

                        <div className="price-preview-profit">
                          <span>Keuntungan per unit</span>
                          <strong>
                            {profit === null ? "—" : rupiah(profit)}
                          </strong>
                        </div>

                        {estimatedPrice !== null && (
                          <div className="price-preview-profit">
                            <span>Keuntungan seluruh kulakan</span>
                            <strong>
                              {rupiah(profitValue >= 0 ? profit! * quantity : 0)}
                            </strong>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* ACTION */}
                    <div className="price-item-footer">
                      <div className="price-item-note">
                        <AlertCircle size={15} />
                        Harga jual dan stok diperbarui setelah disetujui.
                      </div>

                      <button
                        type="button"
                        className="price-button price-approve-button"
                        disabled={
                          busyId !== "" ||
                          !hasValue ||
                          purchasePrice <= 0 ||
                          !product
                        }
                        onClick={() => void approve(intake)}
                      >
                        {isBusy ? (
                          <>
                            <LoaderCircle
                              size={17}
                              className="price-spin"
                            />
                            Memproses...
                          </>
                        ) : (
                          <>
                            <CheckCircle2 size={17} />
                            Setujui Harga
                          </>
                        )}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <footer className="price-footer">
          <span>TOKO ROSYIDAH</span>
          <span>·</span>
          Manajemen Persetujuan Harga
        </footer>
      </div>
    </main>
  );
}
