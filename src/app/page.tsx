"use client";

import { useState } from "react";
import Canvas from "../../components/Canvas";
import SavedWorksList from "../../components/SavedWorksList";

export default function Home() {
  const [selectedDrawingId, setSelectedDrawingId] = useState<string | null>(null);

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
