"use client";


import { useState, useEffect } from "react";
import KulakanPage from "./dashboard/kulakan/page";
import HargaPage from "./dashboard/harga/page";
import KasirPage from "./dashboard/kasir/page";
import EmployeeDebtManagement from "@/components/employee-debt-management";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import EmployeeManagement from "@/components/employee-management";
import ProductManagement from "../components/product-management";
import {
  Bell, Boxes, ChartNoAxesCombined, ChevronDown,
  CircleDollarSign, ClipboardList, LayoutDashboard,
  PackagePlus, ReceiptText, Settings, ShieldCheck,
  ShoppingCart, Store, Users, Wifi,
  CalendarCheck, HandCoins, Wallet
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

const menu: { key: PageKey; label: string; icon: typeof LayoutDashboard }[] = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "kulakan", label: "Input Kulakan", icon: PackagePlus },
  { key: "harga", label: "Persetujuan Harga", icon: CircleDollarSign },
  { key: "stok", label: "Barang & Stok", icon: Boxes },
  { key: "kasir", label: "Kasir", icon: ShoppingCart },
  { key: "penjualan", label: "Riwayat Penjualan", icon: ReceiptText },
  { key: "laporan", label: "Laporan", icon: ChartNoAxesCombined },
  { key: "pegawai", label: "Akun Pegawai", icon: Users },
  { key: "pengaturan", label: "Pengaturan Toko", icon: Settings },
  { key: "karyawan", label: "Data Karyawan", icon: Users },
{ key: "kehadiran", label: "Kehadiran", icon: CalendarCheck },
{ key: "piutang", label: "Piutang Karyawan", icon: HandCoins },
{ key: "gaji", label: "Gaji Mingguan", icon: Wallet },
];

const rupiah = (n: number) => new Intl.NumberFormat("id-ID", {
  style: "currency", currency: "IDR", maximumFractionDigits: 0
}).format(n);

export default function Home() {
  const [active, setActive] = useState<PageKey>("dashboard");
  const [mobileMenu, setMobileMenu] = useState(false);

  const activeItem = menu.find((item) => item.key === active) ?? menu[0];
const [supabase] = useState(() => createClient());
const [userName, setUserName] = useState("");
const [loggedIn, setLoggedIn] = useState(false);
const [showUserMenu, setShowUserMenu] = useState(false);

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
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, username")
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
  setShowUserMenu(false);
  window.location.href = "/login";
}

  return (
    <main className="app-shell">
      <aside className={`sidebar ${mobileMenu ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-mark"><Store size={23} /></div>
          <div><strong>Toko Rosyidah</strong><span>Sistem Toko & Kasir</span></div>
        </div>
        <div className="store-address">Pasar Sebaung</div>
        <div className="menu-label">MENU UTAMA</div>
        <nav className="nav-list">
          {menu.map(({ key, label, icon: Icon }) => (
            <button key={key} className={`nav-item ${active === key ? "active" : ""}`}
              onClick={() => { setActive(key); setMobileMenu(false); }}>
              <Icon size={18} strokeWidth={1.8} /><span>{label}</span>
              {key === "harga" && <span className="nav-count">!</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="secure-note"><ShieldCheck size={17} /><span>Akses sesuai peran pengguna</span></div>
          <div className="user-mini"><div className="avatar">A</div><div><strong>Admin Toko</strong><span>Pratinjau tampilan</span></div><ChevronDown size={16} /></div>
        </div>
      </aside>

      <section className="main-area">
        <header className="topbar">
          <button className="mobile-menu-button" onClick={() => setMobileMenu(!mobileMenu)} aria-label="Buka menu">☰</button>
          <div className="breadcrumb">Toko Rosyidah <span>/</span> <strong>{activeItem.label}</strong></div>
          
<div className="topbar-right">
  <span className="online-pill">
    <Wifi size={14} /> Online
  </span>

  <button className="icon-button" aria-label="Notifikasi">
    <Bell size={19} />
    <i />
  </button>

  {loggedIn ? (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setShowUserMenu(!showUserMenu)}
        style={{
          border: "none",
          borderRadius: 24,
          background: "#dcefe2",
          color: "#176b45",
          padding: "10px 16px",
          fontWeight: 700,
          fontSize: 12,
          maxWidth: 200,
          cursor: "pointer",
        }}
      >
        {userName}
        <ChevronDown
          size={14}
          style={{
            display: "inline",
            verticalAlign: "middle",
            marginLeft: 6,
          }}
        />
      </button>

      {showUserMenu && (
        <div
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 8px)",
            background: "#fff",
            border: "1px solid #e1e8e3",
            borderRadius: 10,
            padding: 8,
            minWidth: 140,
            zIndex: 20,
            boxShadow: "0 6px 20px rgba(0,0,0,0.08)",
          }}
        >
          <button
            type="button"
            onClick={handleLogout}
            style={{
              width: "100%",
              border: 0,
              background: "transparent",
              padding: 10,
              textAlign: "left",
              color: "#b42318",
              cursor: "pointer",
            }}
          >
            Keluar / Logout
          </button>
        </div>
      )}
    </div>
  ) : (
    <Link
      href="/login"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#176b45",
        color: "#fff",
        borderRadius: 22,
        padding: "10px 20px",
        fontSize: 12,
        fontWeight: 700,
        textDecoration: "none",
      }}
    >
      Login
    </Link>
  )}
</div>

        </header>

        
<div className="page-content">
  {active === "dashboard" ? (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">RINGKASAN TOKO</div>
          <h1>Dashboard Admin</h1>
          <p>Selamat datang di pengelolaan Toko Rosyidah.</p>
        </div>
        <div className="date-chip">
          {new Date().toLocaleDateString("id-ID", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </div>
      </div>

      <div className="notice-card">
        <div className="notice-icon"><Bell size={20} /></div>
        <div>
          <strong>Persetujuan harga menunggu</strong>
          <p>Kulakan baru akan muncul di sini setelah fitur database dihubungkan.</p>
        </div>
        <button onClick={() => setActive("harga")}>
          Lihat antrean <span>→</span>
        </button>
      </div>

      <div className="stats-grid">
        <StatCard title="Total Barang" value="—" note="Menunggu koneksi database" icon={<Boxes size={20} />} />
        <StatCard title="Stok Menipis" value="—" note="Akan dihitung dari stok aktif" icon={<ClipboardList size={20} />} />
        <StatCard title="Penjualan Hari Ini" value={rupiah(0)} note="Belum ada data transaksi" icon={<ReceiptText size={20} />} />
        <StatCard title="Laba Kotor Hari Ini" value={rupiah(0)} note="Dari snapshot transaksi" icon={<ChartNoAxesCombined size={20} />} />
      </div>

      <div className="content-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Akses Cepat</h2>
              <p>Pilih aktivitas yang ingin dilakukan.</p>
            </div>
          </div>
          <div className="quick-grid">
            <QuickAction icon={<PackagePlus size={20} />} title="Input Kulakan" desc="Catat barang masuk" onClick={() => setActive("kulakan")} />
            <QuickAction icon={<CircleDollarSign size={20} />} title="Atur Harga Jual" desc="Tinjau harga barang" onClick={() => setActive("harga")} />
            <QuickAction icon={<ShoppingCart size={20} />} title="Buka Kasir" desc="Halaman transaksi" onClick={() => setActive("kasir")} />
            <QuickAction icon={<ChartNoAxesCombined size={20} />} title="Lihat Laporan" desc="Ringkasan penjualan" onClick={() => setActive("laporan")} />
          </div>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Aktivitas Terbaru</h2>
              <p>Jejak aktivitas toko</p>
            </div>
            <span className="subtle-label">REAL-TIME SETELAH TERHUBUNG</span>
          </div>
          <div className="empty-state">
            <div className="empty-icon"><ClipboardList size={22} /></div>
            <strong>Belum ada aktivitas</strong>
            <p>Aktivitas kulakan, perubahan harga, dan penjualan akan tampil di sini.</p>
          </div>
        </section>
      </div>

      <div className="bottom-info">
        <ShieldCheck size={18} />
        <div>
          <strong>Harga transaksi akan tersimpan sebagai snapshot.</strong>
          <span>Perubahan harga di kemudian hari tidak akan mengubah transaksi yang sudah selesai.</span>
        </div>
      </div>
    </>

) : active === "kulakan" ? (
  <KulakanPage />
) : active === "harga" ? (
  <HargaPage />
) : active === "kasir" ? (
  <KasirPage />
) : active === "karyawan" ? (
  <EmployeeManagement />
) : active === "stok" ? (
  <ProductManagement />
) : active === "piutang" ? (
  <EmployeeDebtManagement />
) : (
  <>

      <div className="placeholder-page">
        <div className="placeholder-icon">
          <activeItem.icon size={28} />
        </div>
        <div className="eyebrow">TOKO ROSYIDAH</div>
        <h1>{activeItem.label}</h1>
      
      <p>
        Halaman ini sedang dalam pengembangan.
        Silakan kembali ke dashboard atau pilih menu lainnya.
      </p>
    </div>

     
      <button
      className="primary-button"
      onClick={() => setActive("dashboard")}
    >
      Kembali ke Dashboard
    </button>
  </>
)}
</div>


        <footer className="footer">
        © {new Date().getFullYear()} Toko Rosyidah
        <span>•</span> Sistem manajemen toko
      </footer>
  </section>
</main>
);
}

function StatCard({ title, value, note, icon }: { title: string; value: string; note: string; icon: React.ReactNode }) {
  return <div className="stat-card"><div className="stat-top"><span>{title}</span><div className="stat-icon">{icon}</div></div><strong className="stat-value">{value}</strong><span className="stat-note">{note}</span></div>;
}
function QuickAction({ icon, title, desc, onClick }: { icon: React.ReactNode; title: string; desc: string; onClick: () => void }) {
  return <button className="quick-action" onClick={onClick}><span className="quick-icon">{icon}</span><span className="quick-copy"><strong>{title}</strong><small>{desc}</small></span><span className="quick-arrow">→</span></button>;
}
