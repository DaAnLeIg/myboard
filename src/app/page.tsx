"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Canvas from "../../components/Canvas";
import SavedWorksList from "../../components/SavedWorksList";

function HomeContent() {
  const searchParams = useSearchParams();
  const [selectedDrawingId, setSelectedDrawingId] = useState<string | null>(null);

  useEffect(() => {
    const id = searchParams.get("id") ?? searchParams.get("drawing");
    if (id) {
      setSelectedDrawingId(id);
    }
  }, [searchParams]);

  return (
    <>
      <Canvas selectedDrawingId={selectedDrawingId} />
      <SavedWorksList
        selectedDrawingId={selectedDrawingId}
        onSelectDrawing={setSelectedDrawingId}
      />
    </>
  );
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-zinc-100 text-sm text-zinc-600">
          Загрузка…
        </div>
      }
    >
      <HomeContent />
    </Suspense>
  );
}
