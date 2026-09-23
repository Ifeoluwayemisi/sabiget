import { afterEach, describe, expect, it } from "@jest/globals";
import {
  createProductImageUpload,
  PRODUCT_IMAGE_MAX_BYTES,
  validateProductImage,
} from "../services/mediaService.js";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

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
    process.env.MEDIA_BUCKET = "sabiget-media";
    process.env.MEDIA_REGION = "eu-west-1";
    process.env.MEDIA_ACCESS_KEY_ID = "test-access-key";
    process.env.MEDIA_SECRET_ACCESS_KEY = "test-secret-key";
    process.env.MEDIA_PUBLIC_BASE_URL = "https://cdn.example.com";

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
});
