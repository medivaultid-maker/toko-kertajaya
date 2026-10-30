
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import {
  ArrowLeft,
  Store,
  Mail,
  LockKeyhole,
  Eye,
  EyeOff,
  ShieldCheck,
} from "lucide-react";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const supabase = createClient();

      const { data, error: loginError } =
        await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

      if (loginError) {
        setError("Email atau password yang kamu masukkan salah.");
        return;
      }

      if (!data.session) {
        setError("Login berhasil, tetapi sesi belum terbentuk.");
        return;
      }

      const params = new URLSearchParams(window.location.search);
      const next = params.get("next");

      const destination =
        next && next.startsWith("/") && !next.startsWith("//")
          ? next
          : "/dashboard";

      router.replace(destination);
      router.refresh();
    } catch (err) {
      console.error("Login error:", err);
      setError("Terjadi kesalahan. Periksa koneksi internet kamu.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <div className="login-container">

        <Link href="/" className="login-back">
          <span className="login-back-icon">
            <ArrowLeft size={19} />
          </span>
          <span>Kembali ke Beranda</span>
        </Link>

        <section className="login-card">

          <div className="login-brand">
            <div className="login-brand-icon">
              <Store size={37} strokeWidth={1.9} />
            </div>

            <h1>Toko Rosyidah</h1>
            <p>Sistem Manajemen Toko &amp; Kasir</p>
          </div>

          <div className="login-divider" />

          <div className="login-heading">
            <h2>Selamat Datang!</h2>
            <p>Silakan masuk menggunakan akun kamu.</p>
          </div>

          <form onSubmit={handleLogin} className="login-form">

            <div className="login-field">
              <label htmlFor="email">Email Akun</label>

              <div className="login-input-wrapper">
                <Mail size={19} className="login-input-icon" />

                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nama@email.com"
                  autoComplete="username"
                  required
                />
              </div>
            </div>

            <div className="login-field">
              <label htmlFor="password">Password</label>

              <div className="login-input-wrapper">
                <LockKeyhole
                  size={19}
                  className="login-input-icon"
                />

                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Masukkan password"
                  autoComplete="current-password"
                  required
                />

                <button
                  type="button"
                  className="login-eye-button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={
                    showPassword
                      ? "Sembunyikan password"
                      : "Tampilkan password"
                  }
                >
                  {showPassword ? (
                    <EyeOff size={19} />
                  ) : (
                    <Eye size={19} />
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div className="login-error">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="login-submit"
              disabled={loading}
            >
              {loading ? "Memproses..." : "Masuk ke Sistem"}
              {!loading && <ShieldCheck size={20} />}
            </button>

          </form>

          <div className="login-security">
            <ShieldCheck size={18} />
            <span>Login aman untuk pegawai dan admin</span>
          </div>

        </section>

        <footer className="login-footer">
          © {new Date().getFullYear()} Toko Rosyidah
          <span>•</span>
          Pasar Sebaung
        </footer>

      </div>

      <style jsx>{`
        .login-page {
          min-height: 100vh;
          width: 100%;
          box-sizing: border-box;
          padding: 30px 20px;
          background: #f3f7f4;
          color: #1b3025;
          display: flex;
          justify-content: center;
          align-items: center;
          font-family: inherit;
        }

        .login-container {
          width: 100%;
          max-width: 690px;
          margin: 0 auto;
        }

        .login-back {
          display: inline-flex;
          align-items: center;
          gap: 9px;
          margin-bottom: 12px;
          color: #344c3d;
          text-decoration: none;
          font-size: 14px;
          font-weight: 600;
          transition: color 0.2s ease;
        }

        .login-back:hover {
          color: #176b45;
        }

        .login-back-icon {
          width: 35px;
          height: 35px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 10px;
          background: #e7f3eb;
          color: #176b45;
          transition: background 0.2s ease;
        }

        .login-back:hover .login-back-icon {
          background: #d8ecdf;
        }

        .login-card {
          width: 100%;
          box-sizing: border-box;
          padding: 38px 48px 34px;
          background: #ffffff;
          border: 1px solid #e1eae4;
          border-radius: 23px;
          box-shadow: 0 12px 38px rgba(29, 65, 44, 0.06);
        }

        .login-brand {
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .login-brand-icon {
          width: 76px;
          height: 76px;
          border-radius: 23px;
          background: #e9f5ed;
          color: #176b45;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 17px;
        }

        .login-brand h1 {
          margin: 0;
          color: #173b29;
          font-size: 29px;
          line-height: 1.25;
          font-weight: 800;
          letter-spacing: -0.8px;
        }

        .login-brand p {
          margin: 7px 0 0;
          color: #89988e;
          font-size: 15px;
          font-weight: 500;
        }

        .login-divider {
          height: 1px;
          background: #e5ece7;
          margin: 30px 0;
        }

        .login-heading h2 {
          margin: 0;
          color: #243c2d;
          font-size: 27px;
          line-height: 1.3;
          font-weight: 800;
          letter-spacing: -0.5px;
        }

        .login-heading p {
          margin: 7px 0 0;
          color: #89988e;
          font-size: 15px;
          line-height: 1.5;
        }

        .login-form {
          display: flex;
          flex-direction: column;
          gap: 20px;
          margin-top: 28px;
        }

        .login-field {
          display: flex;
          flex-direction: column;
          gap: 9px;
          min-width: 0;
        }

        .login-field label {
          color: #344b3b;
          font-size: 14px;
          font-weight: 700;
        }

        .login-input-wrapper {
          width: 100%;
          height: 57px;
          box-sizing: border-box;
          display: flex;
          align-items: center;
          gap: 13px;
          padding: 0 15px;
          border: 1.5px solid #dce6df;
          border-radius: 12px;
          background: #fbfcfb;
          transition: all 0.2s ease;
        }

        .login-input-wrapper:focus-within {
          border-color: #218653;
          background: #ffffff;
          box-shadow: 0 0 0 3px rgba(33, 134, 83, 0.08);
        }

        .login-input-icon {
          flex-shrink: 0;
          color: #263c30;
        }

        .login-input-wrapper input {
          flex: 1;
          min-width: 0;
          width: 100%;
          height: 100%;
          border: none;
          outline: none;
          background: transparent;
          color: #24382b;
          font-family: inherit;
          font-size: 15px;
          font-weight: 500;
        }

        .login-input-wrapper input::placeholder {
          color: #aab6af;
          opacity: 1;
        }

        .login-eye-button {
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 7px;
          border: none;
          background: transparent;
          color: #91a398;
          cursor: pointer;
          border-radius: 8px;
        }

        .login-eye-button:hover {
          background: #edf5ef;
          color: #176b45;
        }

        .login-error {
          margin: -5px 0 0;
          padding: 11px 13px;
          border: 1px solid #f3c8c5;
          border-radius: 10px;
          background: #fff5f4;
          color: #b42318;
          font-size: 13px;
          line-height: 1.5;
        }

        .login-submit {
          width: 100%;
          min-height: 59px;
          margin-top: 3px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 11px;
          border: none;
          border-radius: 12px;
          background: #176b45;
          color: #ffffff;
          font-family: inherit;
          font-size: 16px;
          font-weight: 700;
          cursor: pointer;
          box-shadow: 0 8px 18px rgba(23, 107, 69, 0.12);
          transition: all 0.2s ease;
        }

        .login-submit:hover:not(:disabled) {
          background: #125b3a;
          transform: translateY(-1px);
          box-shadow: 0 10px 22px rgba(23, 107, 69, 0.17);
        }

        .login-submit:disabled {
          opacity: 0.7;
          cursor: wait;
        }

        .login-security {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 9px;
          margin-top: 24px;
          color: #91a196;
          font-size: 13px;
          font-weight: 500;
          text-align: center;
        }

        .login-security svg {
          flex-shrink: 0;
          color: #91a99a;
        }

        .login-footer {
          display: flex;
          justify-content: center;
          align-items: center;
          flex-wrap: wrap;
          gap: 9px;
          margin-top: 17px;
          color: #98a59c;
          font-size: 12px;
        }

        @media (max-width: 600px) {
          .login-page {
            padding: 20px 15px;
            align-items: center;
          }

          .login-card {
            padding: 30px 22px 27px;
            border-radius: 19px;
          }

          .login-brand-icon {
            width: 67px;
            height: 67px;
            border-radius: 19px;
            margin-bottom: 14px;
          }

          .login-brand h1 {
            font-size: 25px;
          }

          .login-brand p {
            font-size: 13px;
          }

          .login-divider {
            margin: 25px 0;
          }

          .login-heading h2 {
            font-size: 23px;
          }

          .login-heading p {
            font-size: 13px;
          }

          .login-form {
            margin-top: 24px;
            gap: 18px;
          }

          .login-input-wrapper {
            height: 54px;
            gap: 11px;
            padding: 0 12px;
          }

          .login-input-wrapper input {
            font-size: 14px;
          }

          .login-submit {
            min-height: 55px;
            font-size: 15px;
          }

          .login-security {
            font-size: 11px;
            margin-top: 21px;
          }
        }

        @media (max-height: 700px) and (min-width: 601px) {
          .login-page {
            align-items: flex-start;
          }
        }
      `}</style>
    </main>
  );
}
