
import type { Metadata } from "next";
import { DM_Sans, Manrope } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
});

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Toko Rosyidah | Premium Store Management",
    template: "%s | Toko Rosyidah",
  },
  description:
    "Sistem manajemen Toko Rosyidah untuk pengelolaan stok, kulakan, harga jual, transaksi kasir, pegawai, dan laporan keuangan.",
  applicationName: "Toko Rosyidah",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Toko Rosyidah",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body className={`${dmSans.variable} ${manrope.variable}`}>
        {children}
      </body>
    </html>
  );
}
