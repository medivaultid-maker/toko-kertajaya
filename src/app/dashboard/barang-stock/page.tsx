"use client";

import ProductManagement from "./ProductManagement";

export default function BarangStockPage({
  lowStockOnly = false,
}: {
  lowStockOnly?: boolean;
}) {
  return <ProductManagement lowStockOnly={lowStockOnly} />;
}