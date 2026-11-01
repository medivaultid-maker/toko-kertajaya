"use client";

import {
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

import KulakanPage from "./kulakan/page";
import HargaPage from "./harga/page";
import KasirPage from "./kasir/page";
import RiwayatPenjualanPage from "./riwayat-penjualan/page";

import EmployeeDebtManagement from "./piutang-pegawai/page";
import EmployeeManagement from "./data-pegawai/page";
import ProductManagement from "./barang-stock/page";
import EmployeeAccountManagement from "./akun-pegawai/page";
import AttendancePage from "./kehadiran/page";
import EmployeePayrollManagement from "./gaji-pegawai/page";
import CashDrawerPage from "./kas-harian/page";

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
  X,
  Users,
} from "lucide-react";

type DashboardStats = {
  totalProducts: number;
  lowStock: number;
  todaySales: number;
  todayProfit: number;
  todayTransactions: number;
  pendingIntakes: number;
  activeEmployees: number;
  presentEmployees: number;
  absentEmployees: number;
  unpaidDebt: number;
  draftPayroll: number;
};

type PageKey =
  | "dashboard"
  | "kulakan"
  | "harga"
  | "stok"
  | "kasir"
  | "penjualan"
  | "laporan"
  | "data-pegawai"
  | "akun-pegawai"
  | "pengaturan"
  | "kehadiran"
  | "piutang"
  | "gaji"
  | "kas-harian";

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
  { key: "data-pegawai", label: "Data Pegawai", icon: Users },
  { key: "akun-pegawai", label: "Akun Pegawai", icon: ShieldCheck },
  { key: "kehadiran", label: "Kehadiran", icon: CalendarCheck },
  { key: "piutang", label: "Piutang Pegawai", icon: HandCoins },
  { key: "gaji", label: "Gaji Mingguan", icon: Wallet },
  { key: "kas-harian", label: "Buka & Tutup Kas", icon: Wallet },
];

const rupiah = (n: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);

export default function Home() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());

  const [active, setActive] = useState<PageKey>("dashboard");
  const [activeRestored, setActiveRestored] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(false);

  const [userName, setUserName] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [userRole, setUserRole] = useState("");
  const [pendingIntakeCount, setPendingIntakeCount] = useState(0);

  const [stats, setStats] = useState<DashboardStats>({
    totalProducts: 0,
    lowStock: 0,
    todaySales: 0,
    todayProfit: 0,
    todayTransactions: 0,
    pendingIntakes: 0,
    activeEmployees: 0,
    presentEmployees: 0,
    absentEmployees: 0,
    unpaidDebt: 0,
    draftPayroll: 0,
  });

  const [dashboardLoading, setDashboardLoading] = useState(true);

  const activeItem = menu.find((item) => item.key === active) ?? menu[0];

  // =====================================================
  // MEMUAT STATISTIK DASHBOARD
  // =====================================================

  const loadDashboardStats = useCallback(async () => {
    setDashboardLoading(true);

    try {
      // Tanggal hari ini berdasarkan WIB
      const dateParts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Jakarta",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).formatToParts(new Date());

      const year = dateParts.find((p) => p.type === "year")?.value;
      const month = dateParts.find((p) => p.type === "month")?.value;
      const day = dateParts.find((p) => p.type === "day")?.value;

      const today = `${year}-${month}-${day}`;

      const startDate = new Date(`${today}T00:00:00+07:00`);
      const startOfDay = startDate.toISOString();
      const endOfDay = new Date(
        startDate.getTime() + 24 * 60 * 60 * 1000
      ).toISOString();

      const [
        productsResult,
        lowStockResult,
        salesResult,
        profitResult,
        intakeResult,
        employeesResult,
        attendanceResult,
        debtResult,
        payrollResult,
      ] = await Promise.all([
        supabase
          .from("products")
          .select("id", { count: "exact", head: true })
          .eq("is_active", true),

        supabase
  .from("products")
  .select("id, stock_quantity")
  .eq("is_active", true)
  .lt("stock_quantity", 3),

        supabase
          .from("sales")
          .select("id, total")
          .eq("status", "completed")
          .gte("created_at", startOfDay)
          .lt("created_at", endOfDay),

        supabase
          .from("sale_items")
          .select(`
            gross_profit_snapshot,
            sales!inner (
              status,
              created_at
            )
          `)
          .eq("sales.status", "completed")
          .gte("sales.created_at", startOfDay)
          .lt("sales.created_at", endOfDay),

        supabase
          .from("purchase_intakes")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending_price"),

        supabase
          .from("employees")
          .select("id", { count: "exact", head: true })
          .eq("is_active", true),

        supabase
  .from("attendance")
  .select("id, employee_id")
  .eq("attendance_date", today),

        supabase
          .from("employee_debts")
          .select("remaining_amount")
          .eq("status", "unpaid"),

        supabase
          .from("employee_payrolls")
          .select("id", { count: "exact", head: true })
          .eq("payment_status", "draft"),
      ]);

      // Periksa error masing-masing query
      const queryResults = [
        { name: "Total barang", result: productsResult },
        { name: "Stok menipis", result: lowStockResult },
        { name: "Penjualan", result: salesResult },
        { name: "Laba kotor", result: profitResult },
        { name: "Kulakan", result: intakeResult },
        { name: "pegawai", result: employeesResult },
        { name: "Kehadiran", result: attendanceResult },
        { name: "Piutang", result: debtResult },
        { name: "Gaji", result: payrollResult },
      ];

      queryResults.forEach(({ name, result }) => {
        if (result.error) {
          console.error(`Gagal memuat ${name}:`, result.error);
        }
      });

      // Gunakan data yang berhasil dimuat
      const sales = salesResult.error ? [] : salesResult.data ?? [];
      const profits = profitResult.error ? [] : profitResult.data ?? [];
      const attendance = attendanceResult.error
        ? []
        : attendanceResult.data ?? [];
      const debts = debtResult.error ? [] : debtResult.data ?? [];
      const lowStockProducts = lowStockResult.error
        ? []
        : lowStockResult.data ?? [];

      const lowStockCount = lowStockProducts.length;

      const totalSales = sales.reduce(
        (sum, item) => sum + Number(item.total ?? 0),
        0
      );

      const totalProfit = profits.reduce(
        (sum, item) =>
          sum + Number(item.gross_profit_snapshot ?? 0),
        0
      );

      const totalDebt = debts.reduce(
        (sum, item) => sum + Number(item.remaining_amount ?? 0),
        0
      );

      setStats({
        totalProducts: productsResult.error
          ? 0
          : productsResult.count ?? 0,

        lowStock: lowStockCount,
        todaySales: totalSales,
        todayProfit: totalProfit,
        todayTransactions: sales.length,

        pendingIntakes: intakeResult.error
          ? 0
          : intakeResult.count ?? 0,

        activeEmployees: employeesResult.error
          ? 0
          : employeesResult.count ?? 0,

       presentEmployees: attendance.length,

absentEmployees: Math.max(
  0,
  (employeesResult.error ? 0 : employeesResult.count ?? 0) -
    attendance.length
),

        unpaidDebt: totalDebt,

        draftPayroll: payrollResult.error
          ? 0
          : payrollResult.count ?? 0,
      });

      console.log("Statistik dashboard selesai dimuat.");
    } catch (error) {
      console.error("Gagal memuat statistik dashboard:", error);
    } finally {
      setDashboardLoading(false);
    }
  }, [supabase]);

  // =====================================================
  // MEMULIHKAN HALAMAN TERAKHIR
  // =====================================================

  useEffect(() => {
    const savedPage = localStorage.getItem(
      "toko-rosyidah-active-page"
    ) as PageKey | null;

    if (savedPage && menu.some((item) => item.key === savedPage)) {
      setActive(savedPage);
    }

    setActiveRestored(true);
  }, []);

  // =====================================================
  // MENYIMPAN HALAMAN AKTIF
  // =====================================================

  useEffect(() => {
    if (!activeRestored) return;

    localStorage.setItem("toko-rosyidah-active-page", active);
  }, [active, activeRestored]);

  // =====================================================
  // AUTENTIKASI PENGGUNA
  // =====================================================

  useEffect(() => {
    let mounted = true;

    async function loadUser() {
      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (!mounted) return;

        if (userError || !user) {
          setLoggedIn(false);
          setUserName("");
          setUserRole("");
          setAuthLoading(false);
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("full_name, username, role")
          .eq("id", user.id)
          .maybeSingle();

        if (!mounted) return;

        if (profileError) {
          console.error("Gagal memuat profil pengguna:", profileError);
        }

        setLoggedIn(true);

        setUserName(
          profile?.full_name ||
            profile?.username ||
            user.email ||
            "Pengguna"
        );

        setUserRole(profile?.role || "");
        setAuthLoading(false);
      } catch (error) {
        console.error("Gagal memeriksa autentikasi:", error);

        if (!mounted) return;

        setLoggedIn(false);
        setUserName("");
        setUserRole("");
        setAuthLoading(false);
      }
    }

    void loadUser();

    // Hindari menjalankan query Supabase langsung di callback auth.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      Promise.resolve().then(() => {
        if (mounted) void loadUser();
      });
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  // =====================================================
  // REDIRECT JIKA BELUM LOGIN
  // =====================================================

  useEffect(() => {
    if (!authLoading && !loggedIn) {
      router.replace("/login?next=/dashboard");
    }
  }, [authLoading, loggedIn, router]);

  // =====================================================
  // MEMUAT STATISTIK SETELAH LOGIN
  // =====================================================

  useEffect(() => {
    if (authLoading || !loggedIn || userRole === "employee") {
      return;
    }

    void loadDashboardStats();
  }, [authLoading, loggedIn, userRole, loadDashboardStats]);

  // =====================================================
  // NOTIFIKASI KULAKAN
  // =====================================================

  useEffect(() => {
    if (authLoading || !loggedIn || userRole === "employee") {
      return;
    }

    let mounted = true;

    async function loadPendingIntakes() {
      const { count, error } = await supabase
        .from("purchase_intakes")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending_price");

      if (!error && mounted) {
        setPendingIntakeCount(count ?? 0);
      }

      if (error) {
        console.error("Gagal memuat notifikasi kulakan:", error);
      }
    }

    void loadPendingIntakes();

  // =====================================================
// REALTIME SUPABASE - OWNER DASHBOARD
// =====================================================

const realtimeTables = [
  "products",
  "sales",
  "sale_items",
  "purchase_intakes",
  "employees",
  "employee_attendance",
  "employee_debts",
  "employee_payrolls",
];

const channel = supabase.channel("owner-dashboard-realtime");

realtimeTables.forEach((table) => {
  channel.on(
    "postgres_changes",
    {
      event: "*",
      schema: "public",
      table: table,
    },
    () => {
      void loadDashboardStats();

      if (table === "purchase_intakes") {
        void loadPendingIntakes();
      }
    }
  );
});

channel.subscribe();

return () => {
  mounted = false;
  void supabase.removeChannel(channel);
};

  }, [
    supabase,
    authLoading,
    loggedIn,
    userRole,
    loadDashboardStats,
  ]);

// =====================================================
// LOGOUT
// =====================================================

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

  router.replace("/login");
  router.refresh();
}

function handleMenuClick(key: PageKey) {
  setActive(key);
  setMobileMenu(false);
  setShowUserMenu(false);
}

// =====================================================
// AKSES DASHBOARD OWNER
// =====================================================

const isOwner = ["owner", "admin", "pemilik"].includes(
  userRole.toLowerCase()
);

if (userRole === "employee") {
  router.replace("/pegawai");

  return (
    <main className="loading-screen">
      <div className="loading-content">
        <div className="loading-logo">
          <Store size={28} />
        </div>
        <strong>Toko Rosyidah</strong>
        <span>Membuka dashboard pegawai...</span>
        <div className="loading-spinner" />
      </div>
    </main>
  );
}

  // =====================================================
  // DASHBOARD OWNER / ADMIN
  // =====================================================

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

      {/* PEMICU SIDEBAR DESKTOP */}
      <div
        className="sidebar-edge-trigger"
        onMouseEnter={() => setDesktopSidebarOpen(true)}
      />

      {/* SIDEBAR */}
      <aside
        className={`sidebar ${
          mobileMenu ? "sidebar-open" : ""
        } ${
          desktopSidebarOpen ? "sidebar-hover-open" : ""
        }`}
        onMouseEnter={() => setDesktopSidebarOpen(true)}
        onMouseLeave={() => setDesktopSidebarOpen(false)}
      >
        <div className="brand">
          <div className="brand-mark">
            <Store size={23} />
          </div>

          <div className="brand-text">
            <strong>Toko Rosyidah</strong>
            <span>Sistem Toko</span>
          </div>
        </div>

        <div className="store-address">
          <span className="store-address-dot" />
          Sebaung
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

              {key === "harga" && pendingIntakeCount > 0 && (
                <span className="nav-count">
                  {pendingIntakeCount}
                </span>
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
              {mobileMenu ? <X size={22} /> : <Menu size={22} />}
            </button>

            <div className="breadcrumb">
              <button
                type="button"
                className={`breadcrumb-home ${
                  active === "dashboard" ? "breadcrumb-active" : ""
                }`}
                onClick={() => handleMenuClick("dashboard")}
              >
                Toko Rosyidah
              </button>

              <span className="breadcrumb-separator">/</span>

              <button
                type="button"
                className={`breadcrumb-page ${
                  active === "dashboard" ? "breadcrumb-active" : ""
                }`}
                onClick={() => handleMenuClick(active)}
              >
                {activeItem.label}
              </button>
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

                <span className="user-menu-name">{userName}</span>

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
                  <div className="eyebrow">RINGKASAN TOKO</div>

                  <h1>Dashboard Owner</h1>

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
                    timeZone: "Asia/Jakarta",
                  })}
                </div>
              </div>

              {/* NOTIFIKASI KULAKAN */}
              {pendingIntakeCount > 0 && (
                <div className="notice-card">
                  <div className="notice-icon">
                    <Bell size={20} />
                  </div>

                  <div className="notice-content">
                    <strong>
                      {pendingIntakeCount} kulakan menunggu persetujuan
                      harga
                    </strong>

                    <p>
                      Ada {pendingIntakeCount} kulakan baru yang sudah
                      diinput dan perlu diperiksa sebelum harga jual
                      ditetapkan.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleMenuClick("harga")}
                  >
                    Periksa sekarang <span>→</span>
                  </button>
                </div>
              )}

              {/* STATISTIK UTAMA */}
              <div className="stats-grid">
                <StatCard
                  title="Total Barang"
                  value={
                    dashboardLoading
                      ? "Memuat..."
                      : stats.totalProducts.toLocaleString("id-ID")
                  }
                  note="Jumlah produk aktif"
                  icon={<Boxes size={20} />}
                />

                <StatCard
                  title="Stok Menipis"
                  value={
                    dashboardLoading
                      ? "Memuat..."
                      : stats.lowStock.toLocaleString("id-ID")
                  }
                  note="Barang yang perlu segera diisi"
                  icon={<ClipboardList size={20} />}
                />

                <StatCard
                  title="Penjualan Hari Ini"
                  value={
                    dashboardLoading
                      ? "Memuat..."
                      : rupiah(stats.todaySales)
                  }
                  note={`${stats.todayTransactions} transaksi selesai`}
                  icon={<ReceiptText size={20} />}
                />

                <StatCard
                  title="Laba Kotor Hari Ini"
                  value={
                    dashboardLoading
                      ? "Memuat..."
                      : rupiah(stats.todayProfit)
                  }
                  note="Berdasarkan snapshot transaksi"
                  icon={<ChartNoAxesCombined size={20} />}
                />
              </div>

              {/* RINGKASAN AKTIVITAS TOKO */}
              <div className="dashboard-section">
                <div className="section-heading">
                  <div>
                    <h2>Ringkasan Aktivitas Toko</h2>
                    <p>
                      Pantau aktivitas operasional dan kewajiban toko hari
                      ini.
                    </p>
                  </div>
                </div>

                <div className="stats-grid">
                  <StatCard
                    title="Kulakan Menunggu Persetujuan"
                    value={
                      dashboardLoading
                        ? "Memuat..."
                        : stats.pendingIntakes.toLocaleString("id-ID")
                    }
                    note="Menunggu penetapan harga jual"
                    icon={<PackagePlus size={20} />}
                  />

                  <StatCard
                    title="Pegawai Aktif"
                    value={
                      dashboardLoading
                        ? "Memuat..."
                        : stats.activeEmployees.toLocaleString("id-ID")
                    }
                    note="Total pegawai aktif"
                    icon={<Users size={20} />}
                  />

                  <StatCard
                    title="Hadir Hari Ini"
                    value={
                      dashboardLoading
                        ? "Memuat..."
                        : stats.presentEmployees.toLocaleString("id-ID")
                    }
                    note="Pegawai tercatat hadir"
                    icon={<CalendarCheck size={20} />}
                  />

                  <StatCard
                    title="Tidak Hadir Hari Ini"
                    value={
                      dashboardLoading
                        ? "Memuat..."
                        : stats.absentEmployees.toLocaleString("id-ID")
                    }
                    note="Pegawai tercatat tidak hadir"
                    icon={<Users size={20} />}
                  />

                  <StatCard
                    title="Gaji Menunggu Pembayaran"
                    value={
                      dashboardLoading
                        ? "Memuat..."
                        : stats.draftPayroll.toLocaleString("id-ID")
                    }
                    note="Periode gaji berstatus draft"
                    icon={<Wallet size={20} />}
                  />

                  <StatCard
                    title="Total Piutang Pegawai"
                    value={
                      dashboardLoading
                        ? "Memuat..."
                        : rupiah(stats.unpaidDebt)
                    }
                    note="Akumulasi piutang yang belum lunas"
                    icon={<HandCoins size={20} />}
                  />
                </div>
              </div>

              {/* AKSES CEPAT */}
              <div className="dashboard-section">
                <div className="section-heading">
                  <div>
                    <h2>Akses Cepat</h2>
                    <p>Pilih fitur yang ingin kamu buka.</p>
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
                    <span>Buat transaksi penjualan</span>
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
                    <span>Catat barang masuk</span>
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
                    <span>Kelola inventaris toko</span>
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
                    <span>Lihat transaksi sebelumnya</span>
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
            ) : active === "kas-harian" ? (
  <CashDrawerPage />
          ) : active === "penjualan" ? (
            <RiwayatPenjualanPage />
) : active === "akun-pegawai" ? (
  <EmployeeAccountManagement />
) : active === "data-pegawai" ? (
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

              <div className="eyebrow">TOKO ROSYIDAH</div>

              <h1>{activeItem.label}</h1>

              <p>
                Halaman ini sedang dalam pengembangan. Silakan kembali ke
                dashboard atau pilih menu lainnya.
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
          Sistem Manajemen Toko
        </footer>
      </section>
    </main>
  );
}

// =====================================================
// KOMPONEN KARTU STATISTIK
// =====================================================

function StatCard({
  title,
  value,
  note,
  icon,
}: {
  title: string;
  value: string;
  note: string;
  icon: ReactNode;
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