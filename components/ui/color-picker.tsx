"use client";

import { HexColorPicker } from "react-colorful";
import { cn } from "../../utils/cn";

type ColorPickerProps = {
  color: string;
  onChange: (next: string) => void;
  className?: string;
};

export function ColorPicker({ color, onChange, className }: ColorPickerProps) {
  return (
    <div className={cn("w-full", className)}>
      <HexColorPicker color={color} onChange={onChange} style={{ width: "100%" }} />
    </div>
  );
}
