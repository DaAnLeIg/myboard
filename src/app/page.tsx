"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Canvas from "../../components/Canvas";
import { LoadingPage } from "../../components/LoadingPage";

function HomeContent() {
  const searchParams = useSearchParams();
  const [selectedDrawingId, setSelectedDrawingId] = useState<string | null>(null);

  useEffect(() => {
    const id = searchParams.get("id") ?? searchParams.get("drawing");
    setSelectedDrawingId(id ?? null);
  }, [searchParams]);

  return <Canvas selectedDrawingId={selectedDrawingId} />;
}

export default function Home() {
  return (
    <Suspense fallback={<LoadingPage />}>
      <HomeContent />
    </Suspense>
  );
}
