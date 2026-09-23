import { apiRequest } from "@/lib/api/client";

/**
 * Product API client for vendor menu management.
 * Contracts (backend authoritative):
 *   POST   /products            create (VENDOR only)
 *   PATCH  /products/:id        update (owner only)
 *   DELETE /products/:id        delete (owner only)
 *   GET    /vendors/me          vendor record incl. ALL products (menu source;
 *                               the public GET /products hides unavailable ones)
 */

export interface Product {
  id: string;
  vendorId: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  isAvailable: boolean;
  preparationTime: number;
  category: string | null;
  tags: string[];
  stockQuantity: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProductPayload {
  name: string;
  price: number;
  description?: string;
  category?: string;
  imageUrl?: string | null;
  isAvailable?: boolean;
  preparationTime?: number;
  stockQuantity?: number | null;
}

/** PATCH accepts any subset of fields; the backend only updates provided keys. */
export type ProductUpdatePayload = Partial<ProductPayload>;

interface ProductImageUploadResponse {
  upload?: {
    uploadUrl: string;
    imageUrl: string;
  };
}

export async function uploadProductImage(file: File): Promise<string> {
  const response = await apiRequest("/products/image-upload", {
    method: "POST",
    body: JSON.stringify({
      contentType: file.type,
      size: file.size,
    }),
  });
  if (!response.ok) throw new Error(await parseBackendError(response));

  const data = (await response.json()) as ProductImageUploadResponse;
  if (!data.upload?.uploadUrl || !data.upload.imageUrl) {
    throw new Error("The image upload service returned an invalid response.");
  }

  const uploadResponse = await fetch(data.upload.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });
  if (!uploadResponse.ok) {
    throw new Error("Image upload failed. Please try again.");
  }

  return data.upload.imageUrl;
}

async function parseBackendError(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as {
      error?: unknown;
      message?: unknown;
    };
    if (typeof data.error === "string" && data.error) return data.error;
    if (typeof data.message === "string" && data.message) return data.message;
  } catch {
    // fall through to the generic message when the body is not JSON
  }
  return "Product request failed. Please try again.";
}

/** Fetch the authenticated vendor's full product list (available + unavailable). */
export async function fetchVendorProducts(signal?: AbortSignal): Promise<Product[]> {
  const response = await apiRequest("/vendors/me", { signal });
  if (!response.ok) throw new Error(await parseBackendError(response));
  const data = (await response.json()) as {
    success?: unknown;
    vendor?: { products?: unknown };
  };
  const products = data?.vendor?.products;
  if (!Array.isArray(products)) {
    throw new Error("Unexpected response from the menu service.");
  }
  return products as Product[];
}

export async function createProduct(payload: ProductPayload): Promise<Product> {
  const response = await apiRequest("/products", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(await parseBackendError(response));
  const data = (await response.json()) as { product?: unknown };
  if (!data.product) throw new Error("Product was not created.");
  return data.product as Product;
}

export async function updateProduct(
  id: string,
  payload: ProductUpdatePayload,
): Promise<Product> {
  const response = await apiRequest(`/products/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(await parseBackendError(response));
  const data = (await response.json()) as { product?: unknown };
  if (!data.product) throw new Error("Product was not updated.");
  return data.product as Product;
}

export async function deleteProduct(id: string): Promise<void> {
  const response = await apiRequest(`/products/${id}`, {
    method: "DELETE",
  });
  if (!response.ok) throw new Error(await parseBackendError(response));
}