import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Toko Rosyidah | Sistem Toko & Kasir",
  description:
    "Manajemen stok, kulakan, harga jual, kasir, dan laporan Toko Rosidah.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
