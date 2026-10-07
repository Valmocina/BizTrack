import { supabase } from "@/services/supabaseClient";
import type { Supplier } from "@/types";

export async function listSuppliers(): Promise<Supplier[]> {
  const { data, error } = await supabase
    .from("suppliers")
    .select(`
      id, name, contact_email, category, status,
      supplier_products (
        id, supplier_id, product_id, unit_price,
        products ( name )
      )
    `)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching suppliers:", error.message);
    throw new Error(error.message);
  }

  if (!data) return [];

  return data.map((s: any) => ({
    id: s.id,
    name: s.name,
    contactEmail: s.contact_email ?? "",
    category: s.category ?? "General",
    status: s.status ?? "Active",
    products: Array.isArray(s.supplier_products)
      ? s.supplier_products.map((sp: any) => {
          const prod = Array.isArray(sp.products) ? sp.products[0] : sp.products;
          return {
            id: sp.id,
            supplierId: sp.supplier_id,
            productId: sp.product_id,
            productName: prod?.name ?? "—",
            unitPrice: Number(sp.unit_price ?? 0),
          };
        })
      : [],
  }));
}

export async function addSupplier(input: {
  name: string;
  contactEmail: string;
  category: string;
  initialProducts?: { productId?: string; isNewProduct?: boolean; productName?: string; unitPrice: number }[];
}): Promise<void> {
  // 1. Insert the new supplier
  const { data: newSupplier, error: supplierError } = await supabase
    .from("suppliers")
    .insert([
      {
        name: input.name,
        contact_email: input.contactEmail,
        category: input.category,
        status: "Active",
      },
    ])
    .select("id")
    .single();

  if (supplierError) throw new Error(supplierError.message);

  // 2. Handle products if provided
  if (input.initialProducts && input.initialProducts.length > 0) {
    const productLinks: { supplier_id: string; product_id: string; unit_price: number }[] = [];

    for (const item of input.initialProducts) {
      let targetProductId = item.productId;

      // If it's a new product, insert it into the products table first
      if (item.isNewProduct && item.productName) {
        const generatedSku = `SKU-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 100)}`;
        
        const { data: createdProduct, error: prodErr } = await supabase
          .from("products")
          .insert([
            {
              sku: generatedSku,
              name: item.productName,
              category: input.category || "General",
              price: item.unitPrice,
              stock: 0,
              low_stock_alert: 5,
            },
          ])
          .select("id")
          .single();

        if (prodErr) throw new Error(`Could not create product ${item.productName}: ${prodErr.message}`);
        targetProductId = createdProduct.id;
      }

      if (targetProductId) {
        productLinks.push({
          supplier_id: newSupplier.id,
          product_id: targetProductId,
          unit_price: item.unitPrice,
        });
      }
    }

    if (productLinks.length > 0) {
      const { error: linkError } = await supabase
        .from("supplier_products")
        .insert(productLinks);

      if (linkError) throw new Error(linkError.message);
    }
  }
}

export async function deleteSupplier(id: string): Promise<void> {
  const { error } = await supabase.from("suppliers").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function linkProductToSupplier(input: {
  supplierId: string;
  productId: string;
  unitPrice: number;
}): Promise<void> {
  const { error } = await supabase.from("supplier_products").upsert(
    {
      supplier_id: input.supplierId,
      product_id: input.productId,
      unit_price: input.unitPrice,
    },
    { onConflict: "supplier_id,product_id" }
  );

  if (error) throw new Error(error.message);
}

export async function removeProductFromSupplier(supplierProductId: string): Promise<void> {
  const { error } = await supabase
    .from("supplier_products")
    .delete()
    .eq("id", supplierProductId);

  if (error) throw new Error(error.message);
}