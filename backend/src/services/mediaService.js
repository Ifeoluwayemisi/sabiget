import { randomUUID } from "node:crypto";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const ALLOWED_IMAGE_TYPES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

export const PRODUCT_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

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

export async function createProductImageUpload({ vendorId, contentType }) {
  const config = getMediaConfig();
  if (
    !config.bucket ||
    !config.region ||
    !config.accessKeyId ||
    !config.secretAccessKey
  ) {
    const error = new Error("Product image storage is not configured.");
    error.code = "MEDIA_NOT_CONFIGURED";
    throw error;
  }

  const extension = ALLOWED_IMAGE_TYPES.get(contentType);
  const key = `vendors/${vendorId}/products/${randomUUID()}.${extension}`;
  const client = new S3Client({
    region: config.region,
    endpoint: config.endpoint || undefined,
    forcePathStyle: Boolean(config.endpoint),
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
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
