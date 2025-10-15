import { useEffect, useMemo, useState } from "react";

// Lazy-load xlsx only on demand to keep initial bundle lean
let xlsxPromise: Promise<any> | null = null;
const loadXlsx = () => {
  if (!xlsxPromise) {
    xlsxPromise = import("xlsx");
  }
  return xlsxPromise;
};

export type Product = {
  id: string;
  name: string;
  category: string;
  price: number;
  image: string;
  description: string;
  collection: string;
};

type RawRow = Record<string, any>;

// Eagerly collect local asset urls per latest Vite glob option
const assetModules = import.meta.glob("/src/data/assets/*.png", { eager: true, import: "default", query: "?url" }) as Record<string, string>;
const assetUrls: string[] = Object.values(assetModules).sort();

let cachedProducts: Product[] | null = null;

export async function loadProductsFromExcel(): Promise<Product[]> {
  if (cachedProducts) return cachedProducts;

  const xlsx = await loadXlsx();

  // Resolve Excel file URL relative to this module
  const excelUrl = new URL("./Evol Jewels Hackathon Database .xlsx", import.meta.url);
  const response = await fetch(excelUrl);
  const arrayBuffer = await response.arrayBuffer();
  const workbook = xlsx.read(arrayBuffer, { type: "array" });

  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const rows: RawRow[] = xlsx.utils.sheet_to_json(worksheet, { defval: "" });

  // Try to infer column names; support a few common variants
  const normalizeKey = (key: string) => key.trim().toLowerCase();

  const toProduct = (row: RawRow, index: number): Product => {
    const keys = Object.keys(row).reduce<Record<string, any>>((acc, k) => {
      acc[normalizeKey(k)] = row[k];
      return acc;
    }, {});

    const name = String(
      keys["name"] ?? keys["product"] ?? keys["product name"] ?? `Product ${index + 1}`
    ).trim();

    const category = String(
      keys["category"] ?? keys["type"] ?? keys["collection type"] ?? "Misc"
    ).trim();

    const priceRaw = keys["price"] ?? keys["mrp"] ?? keys["amount"] ?? 0;
    const price = Number(String(priceRaw).replace(/[^0-9.]/g, "")) || 0;

    const description = String(
      keys["description"] ?? keys["details"] ?? keys["short description"] ?? ""
    ).trim();

    const collection = String(
      keys["collection"] ?? keys["series"] ?? keys["line"] ?? "N/A"
    ).trim();

    // Image mapping: use explicit filename/index if present; otherwise cycle sequentially
    const imageName: string | undefined = keys["image"] || keys["image name"] || keys["asset"];
    const imageIndexRaw: number | string | undefined = keys["image index"] || keys["asset index"];

    let imageUrl = assetUrls[index % assetUrls.length] || "";

    if (typeof imageIndexRaw !== "undefined") {
      const idx = Math.max(0, (Number(imageIndexRaw) | 0) - 1);
      imageUrl = assetUrls[idx] ?? imageUrl;
    } else if (imageName) {
      const lower = String(imageName).toLowerCase();
      const match = Object.values(assetModules).find(u => u.toLowerCase().includes(lower));
      if (match) imageUrl = match;
    }

    const id = String(keys["id"] ?? keys["sku"] ?? keys["code"] ?? `${category}-${index + 1}`).replace(/\s+/g, "-").toLowerCase();

    return {
      id,
      name,
      category,
      price,
      image: imageUrl,
      description,
      collection,
    };
  };

  const products = rows.map(toProduct).filter(p => !!p.name);
  cachedProducts = products;
  return products;
}

export function useProducts() {
  const [products, setProducts] = useState<Product[] | null>(cachedProducts);
  const [loading, setLoading] = useState<boolean>(!cachedProducts);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (cachedProducts) return;
    loadProductsFromExcel()
      .then(data => {
        setProducts(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err?.message || "Failed to load products");
        setLoading(false);
      });
  }, []);

  const categories = useMemo(() => {
    return Array.from(new Set((products ?? []).map(p => p.category))).sort();
  }, [products]);

  return { products, loading, error, categories };
}


