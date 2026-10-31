
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
            <span>Sebaung</span>
          </div>
        </div>

        <Link href="/login" className="public-login-button">
          Login
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
              Login
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

      <footer className="public-footer">
        © {new Date().getFullYear()} Toko Rosyidah
        <span>•</span>
        Sistem Manajemen Toko
      </footer>
    </main>
  );
}
