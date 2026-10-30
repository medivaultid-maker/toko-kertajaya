
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";

import KulakanPage from "./dashboard/kulakan/page";
import HargaPage from "./dashboard/harga/page";
import KasirPage from "./dashboard/kasir/page";
import RiwayatPenjualanPage from "./dashboard/riwayat-penjualan/page";

import EmployeeDebtManagement from "@/components/employee-debt-management";
import EmployeeManagement from "@/components/employee-management";
import ProductManagement from "@/components/product-management";
import EmployeeAccountManagement from "@/components/employee-account-management";
import EmployeeDashboard from "@/components/employee-dashboard";
import AttendancePage from "@/components/attendance-page";
import EmployeePayrollManagement from "@/components/employee-payroll-management";

import {
  Bell,
  Boxes,
  CalendarCheck,
  ChartNoAxesCombined,
  ChevronDown,
  ClipboardList,
  HandCoins,
  LayoutDashboard,
  LogOut,
  Menu,
  PackagePlus,
  ReceiptText,
  ShieldCheck,
  ShoppingCart,
  Store,
  Wallet,
  Wifi,
  X,
  Users,
} from "lucide-react";

type PageKey =
  | "dashboard"
  | "kulakan"
  | "harga"
  | "stok"
  | "kasir"
  | "penjualan"
  | "laporan"
  | "pegawai"
  | "pengaturan"
  | "karyawan"
  | "kehadiran"
  | "piutang"
  | "gaji";

const menu: {
  key: PageKey;
  label: string;
  icon: typeof LayoutDashboard;
}[] = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "stok", label: "Barang & Stok", icon: Boxes },
  { key: "kulakan", label: "Input Kulakan", icon: PackagePlus },
  { key: "harga", label: "Persetujuan Harga", icon: Wallet },
  { key: "kasir", label: "Kasir", icon: ShoppingCart },
  { key: "penjualan", label: "Riwayat Penjualan", icon: ReceiptText },
  { key: "karyawan", label: "Data Karyawan", icon: Users },
  { key: "pegawai", label: "Akun Pegawai", icon: ShieldCheck },
  { key: "kehadiran", label: "Kehadiran", icon: CalendarCheck },
  { key: "piutang", label: "Piutang Karyawan", icon: HandCoins },
  { key: "gaji", label: "Gaji Mingguan", icon: Wallet },
];

const rupiah = (n: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);

export default function Home() {
  const [active, setActive] = useState<PageKey>("dashboard");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [supabase] = useState(() => createClient());

  const [userName, setUserName] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [userRole, setUserRole] = useState("");

  const activeItem = menu.find((item) => item.key === active) ?? menu[0];

  useEffect(() => {
    let mounted = true;

    async function loadUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!mounted) return;

      if (!user) {
        setLoggedIn(false);
        setUserName("");
        setUserRole("");
        setAuthLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, username, role")
        .eq("id", user.id)
        .maybeSingle();

      if (!mounted) return;

      setLoggedIn(true);
      setUserName(
        profile?.full_name ||
          profile?.username ||
          user.email ||
          "Pengguna"
      );
      setUserRole(profile?.role || "");
      setAuthLoading(false);
    }

    void loadUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void loadUser();
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  async function handleLogout() {
    const { error } = await supabase.auth.signOut();

    if (error) {
      alert(`Gagal logout: ${error.message}`);
      return;
    }

    setLoggedIn(false);
    setUserName("");
    setUserRole("");
    setShowUserMenu(false);

    window.location.href = "/login";
  }

  function handleMenuClick(key: PageKey) {
    setActive(key);
    setMobileMenu(false);
    setShowUserMenu(false);
  }

  if (authLoading) {
    return (
      <main className="loading-screen">
        <div className="loading-content">
          <div className="loading-logo">
            <Store size={28} />
          </div>

          <strong>Toko Rosyidah</strong>
          <span>Memeriksa sesi pengguna...</span>

          <div className="loading-spinner" />
        </div>
      </main>
    );
  }

  if (!loggedIn) {
    return <PublicHome />;
  }

  if (userRole === "employee") {
    return <EmployeeDashboard userName={userName} />;
  }

  return (
    <main className="app-shell">
      {/* OVERLAY MOBILE */}
      {mobileMenu && (
        <button
          type="button"
          className="sidebar-overlay"
          aria-label="Tutup menu"
          onClick={() => setMobileMenu(false)}
        />
      )}

      {/* SIDEBAR */}
      <aside
        className={`sidebar ${mobileMenu ? "sidebar-open" : ""}`}
      >
        <div className="brand">
          <div className="brand-mark">
            <Store size={23} />
          </div>

          <div className="brand-text">
            <strong>Toko Rosyidah</strong>
            <span>Sistem Toko & Kasir</span>
          </div>
        </div>

        <div className="store-address">
          <span className="store-address-dot" />
          Pasar Sebaung
        </div>

        <div className="menu-label">MENU UTAMA</div>

        <nav className="nav-list">
          {menu.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              className={`nav-item ${
                active === key ? "active" : ""
              }`}
              onClick={() => handleMenuClick(key)}
            >
              <Icon size={19} strokeWidth={1.8} />

              <span>{label}</span>

              {key === "harga" && (
                <span className="nav-count">!</span>
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="user-mini">
            <div className="user-avatar">
              {userName.charAt(0).toUpperCase()}
            </div>

            <div className="user-mini-info">
              <strong>{userName}</strong>
              <span>Administrator</span>
            </div>
          </div>
        </div>
      </aside>

      {/* AREA UTAMA */}
      <section className="main-area">
        {/* HEADER */}
        <header className="topbar">
          <div className="topbar-left">
            <button
              type="button"
              className="mobile-menu-button"
              onClick={() => setMobileMenu(!mobileMenu)}
              aria-label="Buka menu navigasi"
              aria-expanded={mobileMenu}
            >
              {mobileMenu ? (
                <X size={22} />
              ) : (
                <Menu size={22} />
              )}
            </button>

            <div className="breadcrumb">
              <span className="breadcrumb-home">
                Toko Rosyidah
              </span>

              <span className="breadcrumb-separator">/</span>

              <strong>{activeItem.label}</strong>
            </div>
          </div>

          <div className="topbar-right">
            <div className="user-menu-wrapper">
              <button
                type="button"
                className="user-menu-button"
                onClick={() => setShowUserMenu(!showUserMenu)}
                aria-expanded={showUserMenu}
              >
                <span className="user-menu-avatar">
                  {userName.charAt(0).toUpperCase()}
                </span>

                <span className="user-menu-name">
                  {userName}
                </span>

                <ChevronDown
                  size={16}
                  className={
                    showUserMenu ? "chevron-rotated" : ""
                  }
                />
              </button>

              {showUserMenu && (
                <>
                  <button
                    type="button"
                    className="dropdown-backdrop"
                    aria-label="Tutup menu pengguna"
                    onClick={() => setShowUserMenu(false)}
                  />

                  <div className="user-dropdown">
                    <div className="user-dropdown-info">
                      <strong>{userName}</strong>
                      <span>Administrator</span>
                    </div>

                    <div className="dropdown-divider" />

                    <button
                      type="button"
                      className="logout-button"
                      onClick={handleLogout}
                    >
                      <LogOut size={16} />
                      Keluar / Logout
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* KONTEN HALAMAN */}
        <div className="page-content">
          {active === "dashboard" ? (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">
                    RINGKASAN TOKO
                  </div>

                  <h1>Dashboard Admin</h1>

                  <p>
                    Selamat datang di pengelolaan Toko Rosyidah.
                  </p>
                </div>

                <div className="date-chip">
                  <CalendarCheck size={15} />

                  {new Date().toLocaleDateString("id-ID", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </div>
              </div>

              {/* NOTIFIKASI */}
              <div className="notice-card">
                <div className="notice-icon">
                  <Bell size={20} />
                </div>

                <div className="notice-content">
                  <strong>
                    Persetujuan harga menunggu
                  </strong>

                  <p>
                    Periksa antrean kulakan untuk menyetujui
                    harga jual barang terbaru.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleMenuClick("harga")}
                >
                  Lihat antrean <span>→</span>
                </button>
              </div>

              {/* STATISTIK */}
              <div className="stats-grid">
                <StatCard
                  title="Total Barang"
                  value="—"
                  note="Menunggu koneksi database"
                  icon={<Boxes size={20} />}
                />

                <StatCard
                  title="Stok Menipis"
                  value="—"
                  note="Akan dihitung dari stok aktif"
                  icon={<ClipboardList size={20} />}
                />

                <StatCard
                  title="Penjualan Hari Ini"
                  value={rupiah(0)}
                  note="Belum ada data transaksi"
                  icon={<ReceiptText size={20} />}
                />

                <StatCard
                  title="Laba Kotor Hari Ini"
                  value={rupiah(0)}
                  note="Dari snapshot transaksi"
                  icon={<ChartNoAxesCombined size={20} />}
                />
              </div>

              {/* AKSES CEPAT */}
              <div className="dashboard-section">
                <div className="section-heading">
                  <div>
                    <h2>Akses Cepat</h2>
                    <p>
                      Pilih fitur yang ingin kamu buka.
                    </p>
                  </div>
                </div>

                <div className="quick-grid">
                  <button
                    type="button"
                    className="quick-item"
                    onClick={() => handleMenuClick("kasir")}
                  >
                    <span className="quick-icon">
                      <ShoppingCart size={21} />
                    </span>

                    <strong>Kasir</strong>

                    <span>
                      Buat transaksi penjualan
                    </span>
                  </button>

                  <button
                    type="button"
                    className="quick-item"
                    onClick={() => handleMenuClick("kulakan")}
                  >
                    <span className="quick-icon">
                      <PackagePlus size={21} />
                    </span>

                    <strong>Input Kulakan</strong>

                    <span>
                      Catat barang masuk
                    </span>
                  </button>

                  <button
                    type="button"
                    className="quick-item"
                    onClick={() => handleMenuClick("stok")}
                  >
                    <span className="quick-icon">
                      <Boxes size={21} />
                    </span>

                    <strong>Barang & Stok</strong>

                    <span>
                      Kelola inventaris toko
                    </span>
                  </button>

                  <button
                    type="button"
                    className="quick-item"
                    onClick={() => handleMenuClick("penjualan")}
                  >
                    <span className="quick-icon">
                      <ReceiptText size={21} />
                    </span>

                    <strong>Riwayat Penjualan</strong>

                    <span>
                      Lihat transaksi sebelumnya
                    </span>
                  </button>
                </div>
              </div>
            </>
          ) : active === "kulakan" ? (
            <KulakanPage />
          ) : active === "harga" ? (
            <HargaPage />
          ) : active === "kasir" ? (
            <KasirPage />
          ) : active === "penjualan" ? (
            <RiwayatPenjualanPage />
          ) : active === "pegawai" ? (
            <EmployeeAccountManagement />
          ) : active === "karyawan" ? (
            <EmployeeManagement />
          ) : active === "stok" ? (
            <ProductManagement />
          ) : active === "piutang" ? (
            <EmployeeDebtManagement />
          ) : active === "kehadiran" ? (
            <AttendancePage />
          ) : active === "gaji" ? (
            <EmployeePayrollManagement />
          ) : (
            <div className="placeholder-page">
              <div className="placeholder-icon">
                <activeItem.icon size={28} />
              </div>

              <div className="eyebrow">
                TOKO ROSYIDAH
              </div>

              <h1>{activeItem.label}</h1>

              <p>
                Halaman ini sedang dalam pengembangan.
                Silakan kembali ke dashboard atau pilih
                menu lainnya.
              </p>

              <button
                type="button"
                className="primary-button"
                onClick={() => handleMenuClick("dashboard")}
              >
                Kembali ke Dashboard
              </button>
            </div>
          )}
        </div>

        {/* FOOTER */}
        <footer className="footer">
          © {new Date().getFullYear()} Toko Rosyidah
          <span>•</span>
          Sistem manajemen toko
        </footer>
      </section>
    </main>
  );
}

/* HALAMAN DEPAN PUBLIK */
function PublicHome() {
  return (
    <main className="public-home">
      <header className="public-header">
        <div className="public-brand">
          <div className="public-brand-mark">
            <Store size={25} />
          </div>

          <div>
            <strong>Toko Rosyidah</strong>
            <span>Pasar Sebaung</span>
          </div>
        </div>

        <Link href="/login" className="public-login-button">
          Login Pegawai / Admin
          <ShieldCheck size={17} />
        </Link>
      </header>

      <section className="public-hero">
        <div className="public-hero-inner">
          <div className="public-hero-content">
            <div className="public-eyebrow">
              <Wifi size={15} />
              SISTEM TOKO ROSYIDAH
            </div>

            <h1>
              Selamat Datang di
              <br />
              Toko Rosyidah
            </h1>

            <p>
              Sistem informasi dan pengelolaan Toko Rosyidah.
              Kami hadir untuk memberikan pelayanan yang mudah,
              nyaman, dan terpercaya.
            </p>

            <Link
              href="/login"
              className="public-primary-button"
            >
              Masuk ke Sistem
              <ShieldCheck size={18} />
            </Link>
          </div>

          <div className="public-hero-card">
            <div className="public-hero-decoration">
              <Store size={230} />
            </div>

            <div className="public-hero-icon">
              <Store size={34} />
            </div>

            <h2>Toko Rosyidah</h2>

            <p>
              Melayani kebutuhan Anda dengan sepenuh hati.
            </p>

            <div className="public-hero-card-footer">
              <ShieldCheck size={17} />
              Sistem pengelolaan toko
            </div>
          </div>
        </div>
      </section>

      <section className="public-information">
        <div className="public-section-heading">
          <span>INFORMASI TOKO</span>

          <h2>Selalu Siap Melayani</h2>

          <p>
            Informasi singkat mengenai Toko Rosyidah.
          </p>
        </div>

        <div className="public-information-grid">
          <div className="public-information-card">
            <div className="public-information-icon">
              <Store size={24} />
            </div>

            <h3>Lokasi Toko</h3>

            <p>Pasar Sebaung</p>
          </div>

          <div className="public-information-card">
            <div className="public-information-icon">
              <PackagePlus size={24} />
            </div>

            <h3>Kebutuhan Harian</h3>

            <p>
              Menyediakan berbagai kebutuhan toko.
            </p>
          </div>

          <div className="public-information-card">
            <div className="public-information-icon">
              <ShieldCheck size={24} />
            </div>

            <h3>Pelayanan</h3>

            <p>
              Mengedepankan pelayanan yang nyaman.
            </p>
          </div>
        </div>
      </section>

      <section className="public-login-section">
        <div>
          <h3>Area Khusus Pegawai dan Admin</h3>

          <p>
            Silakan login untuk mengakses sistem
            pengelolaan toko.
          </p>
        </div>

        <Link
          href="/login"
          className="public-login-section-button"
        >
          Login Sekarang
          <ShieldCheck size={17} />
        </Link>
      </section>

      <footer className="public-footer">
        © {new Date().getFullYear()} Toko Rosyidah
        <span>•</span>
        Sistem Manajemen Toko
      </footer>
    </main>
  );
}

/* KARTU STATISTIK */
function StatCard({
  title,
  value,
  note,
  icon,
}: {
  title: string;
  value: string;
  note: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="stat-card">
      <div className="stat-top">
        <span>{title}</span>
        <div className="stat-icon">{icon}</div>
      </div>

      <strong className="stat-value">{value}</strong>

      <span className="stat-note">{note}</span>
    </div>
  );
}

