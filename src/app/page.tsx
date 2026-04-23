"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Canvas from "../../components/Canvas";
import SavedWorksList from "../../components/SavedWorksList";

function BooksLibraryIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 19V5" />
      <path d="M4 19h16" />
      <path d="M8 19V8h2.5a2 2 0 0 1 2 2v9" />
      <path d="M13.5 19V6.5a2 2 0 0 1 2-2H18V19" />
    </svg>
  );
}

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
      <Link
        href="/library"
        className="fixed right-4 top-3 z-[60] flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-200 bg-white/95 text-zinc-700 shadow-sm backdrop-blur transition hover:bg-zinc-50"
        title="Библиотека работ"
        aria-label="Библиотека работ"
      >
        <BooksLibraryIcon className="h-5 w-5" />
      </Link>
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
