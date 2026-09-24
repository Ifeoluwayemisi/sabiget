import { randomUUID } from "node:crypto";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const ALLOWED_IMAGE_TYPES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

export const PRODUCT_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

// Server-generated object keys only; never a client filename or free-form path.
const MANAGED_PRODUCT_OBJECT_PATTERN =
  /^vendors\/[^/]+\/products\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/i;

function getMediaConfig() {
  return {
    bucket: process.env.MEDIA_BUCKET || "",
    region: process.env.MEDIA_REGION || process.env.AWS_REGION || "",
    endpoint: process.env.MEDIA_ENDPOINT || process.env.AWS_S3_ENDPOINT || "",
    accessKeyId:
      process.env.MEDIA_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey:
      process.env.MEDIA_SECRET_ACCESS_KEY ||
      process.env.AWS_SECRET_ACCESS_KEY ||
      "",
    publicBaseUrl: process.env.MEDIA_PUBLIC_BASE_URL || "",
  };
}

export function validateProductImage({ contentType, size }) {
  if (!ALLOWED_IMAGE_TYPES.has(contentType)) {
    return {
      valid: false,
      error: "Product image must be a JPEG, PNG, or WebP file.",
    };
  }

  if (!Number.isInteger(size) || size <= 0 || size > PRODUCT_IMAGE_MAX_BYTES) {
    return {
      valid: false,
      error: "Product image must be between 1 byte and 5 MB.",
    };
  }

  return { valid: true };
}

function getPublicUrl(key, config) {
  if (config.publicBaseUrl) {
    return `${config.publicBaseUrl.replace(/\/$/, "")}/${key
      .split("/")
      .map(encodeURIComponent)
      .join("/")}`;
  }

  if (config.endpoint) {
    return `${config.endpoint.replace(/\/$/, "")}/${config.bucket}/${key
      .split("/")
      .map(encodeURIComponent)
      .join("/")}`;
  }

  return `https://${config.bucket}.s3.${config.region}.amazonaws.com/${key
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
}

function createS3Client(config) {
  return new S3Client({
    region: config.region,
    endpoint: config.endpoint || undefined,
    forcePathStyle: Boolean(config.endpoint),
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}

function isMediaConfigured(config) {
  return Boolean(
    config.bucket && config.region && config.accessKeyId && config.secretAccessKey,
  );
}

function mediaNotConfigured() {
  const error = new Error("Product image storage is not configured.");
  error.code = "MEDIA_NOT_CONFIGURED";
  return error;
}

/**
 * Derive the object key from a stored product image URL and prove it belongs
 * to SabiGet's managed storage and to the given vendor's product namespace.
 *
 * Returns the key when the URL maps to:
 *   vendors/{vendorId}/products/{uuid}.{ext}
 * and the derived key sits under our configured public base URL. Returns null
 * for external vendor-supplied HTTPS URLs and for any key that would belong to
 * a different vendor or a non-product object, so the caller never issues an S3
 * deletion for an object we cannot prove it owns.
 */
export function getManagedProductKeyFromUrl({ imageUrl, vendorId }) {
  if (typeof imageUrl !== "string" || imageUrl.length === 0) return null;
  if (typeof vendorId !== "string" || vendorId.length === 0) return null;

  const config = getMediaConfig();
  const expectedPrefix = `vendors/${vendorId}/products/`;

  let normalized = null;
  if (config.publicBaseUrl) {
    const base = config.publicBaseUrl.replace(/\/$/, "");
    if (imageUrl.startsWith(`${base}/`)) {
      normalized = imageUrl.slice(base.length + 1);
    }
  } else if (config.endpoint) {
    const base = `${config.endpoint.replace(/\/$/, "")}/${config.bucket}`;
    if (imageUrl.startsWith(`${base}/`)) {
      normalized = imageUrl.slice(base.length + 1);
    }
  } else if (config.bucket && config.region) {
    const base = `https://${config.bucket}.s3.${config.region}.amazonaws.com`;
    if (imageUrl.startsWith(`${base}/`)) {
      normalized = imageUrl.slice(base.length + 1);
    }
  }

  if (!normalized) return null;
  const key = normalized
    .split("/")
    .map((segment) => {
      try {
        return decodeURIComponent(segment);
      } catch {
        return segment;
      }
    })
    .join("/");

  if (!key.startsWith(expectedPrefix)) return null;
  if (!MANAGED_PRODUCT_OBJECT_PATTERN.test(key)) return null;

  return key;
}

/**
 * Delete a managed product image object, but ONLY when the URL can be proven
 * to be a SabiGet-managed object owned by the given vendor. External URLs and
 * objects owned by other vendors are never sent to S3.
 *
 * Returns { deleted: true, key } on success, or
 * { deleted: false, reason: "not-managed" | "not-configured" }.
 */
export async function deleteManagedProductImage({ imageUrl, vendorId }) {
  const key = getManagedProductKeyFromUrl({ imageUrl, vendorId });
  if (!key) {
    return { deleted: false, reason: "not-managed" };
  }

  const config = getMediaConfig();
  if (!isMediaConfigured(config)) {
    return { deleted: false, reason: "not-configured" };
  }

  const client = createS3Client(config);
  await client.send(
    new DeleteObjectCommand({ Bucket: config.bucket, Key: key }),
  );

  return { deleted: true, key };
}

export async function createProductImageUpload({ vendorId, contentType }) {
  const config = getMediaConfig();
  if (!isMediaConfigured(config)) {
    throw mediaNotConfigured();
  }

  const extension = ALLOWED_IMAGE_TYPES.get(contentType);
  const key = `vendors/${vendorId}/products/${randomUUID()}.${extension}`;
  const client = createS3Client(config);
  const command = new PutObjectCommand({
    Bucket: config.bucket,
    Key: key,
    ContentType: contentType,
    CacheControl: "public, max-age=31536000, immutable",
  });

  return {
    key,
    imageUrl: getPublicUrl(key, config),
    uploadUrl: await getSignedUrl(client, command, { expiresIn: 600 }),
    expiresIn: 600,
  };
}
