import { Suspense } from "react";
import ShopPage from "@/features/home/ShopPage";

export default function Page() {
  return (
    <Suspense>
      <ShopPage />
    </Suspense>
  );
}
