-- Restore the Vendor <-> User ownership link dropped during a schema refactor.
-- Vendor.userId was already expected by controllers/routes (signup, login,
-- product and vendor routes) but the model + DB column had been removed.
-- Safe as NOT NULL: the Vendor table is empty (verified before writing this).
ALTER TABLE "Vendor" ADD COLUMN "userId" TEXT NOT NULL;

ALTER TABLE "Vendor" ADD CONSTRAINT "Vendor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "Vendor_userId_key" ON "Vendor"("userId");