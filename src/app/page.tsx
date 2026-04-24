"use client";

import { Suspense, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import Canvas from "../../components/Canvas";
import SavedWorksList from "../../components/SavedWorksList";

function HomeContent() {
  const searchParams = useSearchParams();
  const [selectedDrawingId, setSelectedDrawingId] = useState<string | null>(null);

  useEffect(() => {
    const id = searchParams.get("id") ?? searchParams.get("drawing");
    setSelectedDrawingId(id ?? null);
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
        <div className="flex min-h-screen items-center justify-center bg-zinc-100">
          <Loader2 className="h-8 w-8 animate-spin text-zinc-400" strokeWidth={1.75} aria-hidden />
          <span className="sr-only">Загрузка</span>
        </div>
      }
    >
      <HomeContent />
    </Suspense>
  );
}
