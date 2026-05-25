import { Suspense } from "react";
import SharePreviewClient from "./SharePreviewClient";

export default function SharePreviewPage() {
  return (
    <Suspense fallback={null}>
      <SharePreviewClient />
    </Suspense>
  );
}
