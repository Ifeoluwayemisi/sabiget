import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { S3Client } from "@aws-sdk/client-s3";
import {
  createProductImageUpload,
  deleteManagedProductImage,
  getManagedProductKeyFromUrl,
  PRODUCT_IMAGE_MAX_BYTES,
  validateProductImage,
} from "../services/mediaService.js";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
  jest.restoreAllMocks();
});

const MANAGED_IMAGE_URL =
  "https://cdn.example.com/vendors/vendor_123/products/123e4567-e89b-12d3-a456-426614174000.jpg";
const MANAGED_IMAGE_KEY =
  "vendors/vendor_123/products/123e4567-e89b-12d3-a456-426614174000.jpg";

function setMediaConfig() {
  process.env.MEDIA_BUCKET = "sabiget-media";
  process.env.MEDIA_REGION = "eu-west-1";
  process.env.MEDIA_ACCESS_KEY_ID = "test-access-key";
  process.env.MEDIA_SECRET_ACCESS_KEY = "test-secret-key";
  process.env.MEDIA_PUBLIC_BASE_URL = "https://cdn.example.com";
}

describe("mediaService", () => {
  it("accepts supported image types within the size limit", () => {
    expect(
      validateProductImage({ contentType: "image/webp", size: 1024 }),
    ).toEqual({ valid: true });
  });

  it("rejects unsafe types and oversized files", () => {
    expect(
      validateProductImage({ contentType: "image/svg+xml", size: 1024 }),
    ).toMatchObject({ valid: false });
    expect(
      validateProductImage({
        contentType: "image/png",
        size: PRODUCT_IMAGE_MAX_BYTES + 1,
      }),
    ).toMatchObject({ valid: false });
  });

  it("creates vendor-scoped keys without using the client filename", async () => {
    setMediaConfig();

    const result = await createProductImageUpload({
      vendorId: "vendor_123",
      contentType: "image/jpeg",
    });

    expect(result.key).toMatch(/^vendors\/vendor_123\/products\/.+\.jpg$/);
    expect(result.imageUrl).toMatch(
      /^https:\/\/cdn\.example\.com\/vendors\/vendor_123\/products\/.+\.jpg$/,
    );
    expect(result.uploadUrl).toContain("X-Amz-Signature");
    expect(result.expiresIn).toBe(600);
  });

  it("derives a managed key only for the owning vendor's product URL", () => {
    setMediaConfig();

    expect(
      getManagedProductKeyFromUrl({
        imageUrl: MANAGED_IMAGE_URL,
        vendorId: "vendor_123",
      }),
    ).toBe(MANAGED_IMAGE_KEY);

    expect(
      getManagedProductKeyFromUrl({
        imageUrl: MANAGED_IMAGE_URL,
        vendorId: "vendor_other",
      }),
    ).toBeNull();

    expect(
      getManagedProductKeyFromUrl({
        imageUrl: MANAGED_IMAGE_URL,
        vendorId: "vendor_123/traversal",
      }),
    ).toBeNull();
  });

  it("never treats external HTTPS URLs as managed objects", () => {
    setMediaConfig();

    expect(
      getManagedProductKeyFromUrl({
        imageUrl: "https://example.com/images/food.jpg",
        vendorId: "vendor_123",
      }),
    ).toBeNull();

    expect(
      getManagedProductKeyFromUrl({
        imageUrl: "https://cdn.example.com.evil.com/vendors/vendor_123/products/x.jpg",
        vendorId: "vendor_123",
      }),
    ).toBeNull();

    expect(
      getManagedProductKeyFromUrl({
        imageUrl: "",
        vendorId: "vendor_123",
      }),
    ).toBeNull();
  });

  it("rejects unrelated or malformed managed-looking keys", () => {
    setMediaConfig();

    const base = "https://cdn.example.com";
    const vendorBad = `${base}/vendors/vendor_123/banner.jpg`;
    const randomPath = `${base}/some/other/path.jpg`;
    const nonUuid = `${base}/vendors/vendor_123/products/my-photo.jpg`;
    const nested = `${base}/vendors/vendor_123/products/../secrets.jpg`;

    for (const imageUrl of [vendorBad, randomPath, nonUuid, nested]) {
      expect(
        getManagedProductKeyFromUrl({ imageUrl, vendorId: "vendor_123" }),
      ).toBeNull();
    }
  });

  it("refuses any deletion when no storage config exists at all", async () => {
    const send = jest
      .spyOn(S3Client.prototype, "send")
      .mockResolvedValue({});

    const result = await deleteManagedProductImage({
      imageUrl: MANAGED_IMAGE_URL,
      vendorId: "vendor_123",
    });

    expect(result.deleted).toBe(false);
    expect(send).not.toHaveBeenCalled();
  });

  it("fails closed with not-configured when credentials are missing", async () => {
    process.env.MEDIA_PUBLIC_BASE_URL = "https://cdn.example.com";

    const result = await deleteManagedProductImage({
      imageUrl: MANAGED_IMAGE_URL,
      vendorId: "vendor_123",
    });
    expect(result).toEqual({ deleted: false, reason: "not-configured" });
  });

  it("deletes only the owning vendor's managed object", async () => {
    setMediaConfig();
    const send = jest
      .spyOn(S3Client.prototype, "send")
      .mockResolvedValue({});

    const result = await deleteManagedProductImage({
      imageUrl: MANAGED_IMAGE_URL,
      vendorId: "vendor_123",
    });

    expect(result).toEqual({ deleted: true, key: MANAGED_IMAGE_KEY });
    expect(send).toHaveBeenCalledTimes(1);
    const [command] = send.mock.calls[0];
    expect(command.input).toMatchObject({
      Bucket: "sabiget-media",
      Key: MANAGED_IMAGE_KEY,
    });
  });

  it("never sends external or foreign-vendor URLs to S3 deletion", async () => {
    setMediaConfig();
    const send = jest
      .spyOn(S3Client.prototype, "send")
      .mockResolvedValue({});

    const external = await deleteManagedProductImage({
      imageUrl: "https://example.com/images/food.jpg",
      vendorId: "vendor_123",
    });
    expect(external).toEqual({ deleted: false, reason: "not-managed" });

    const foreign = await deleteManagedProductImage({
      imageUrl: MANAGED_IMAGE_URL,
      vendorId: "vendor_other",
    });
    expect(foreign).toEqual({ deleted: false, reason: "not-managed" });

    expect(send).not.toHaveBeenCalled();
  });
});
