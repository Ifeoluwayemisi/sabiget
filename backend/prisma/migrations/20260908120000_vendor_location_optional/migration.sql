-- AlterTable
-- A newly registered vendor may onboard in stages. The store location is no
-- longer forced at signup; nullable coordinates keep the vendor safely
-- "incomplete" (and undiscoverable) until they explicitly save a location.
-- This only relaxes NOT NULL constraints and touches no existing rows.
ALTER TABLE "Vendor" ALTER COLUMN "latitude" DROP NOT NULL,
ALTER COLUMN "longitude" DROP NOT NULL,
ALTER COLUMN "lga" DROP NOT NULL;