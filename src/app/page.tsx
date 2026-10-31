
import Link from "next/link";
import {
  Store,
  ShieldCheck,
  PackagePlus,
  Wifi,
} from "lucide-react";

export default function PublicHome() {
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
          Login Owner / Pegawai
          <ShieldCheck size={17} />
        </Link>
      </header>

      <section className="public-hero">
        <div className="public-hero-inner">
          <div className="public-hero-content">
            <div className="public-eyebrow">
              
              SISTEM PENGELOLAAN TOKO
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
          <h3>Area Khusus Owner dan Pegawai</h3>

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
