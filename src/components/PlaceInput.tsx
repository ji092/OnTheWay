"use client";
import { useEffect, useRef, useState } from "react";
import type { Place } from "@/lib/types";

export default function PlaceInput({
  label,
  value,
  onSelect,
  dotColor,
}: {
  label: string;
  value: Place | null;
  onSelect: (p: Place) => void;
  dotColor: string;
}) {
  const [text, setText] = useState(value?.name ?? "");
  const [options, setOptions] = useState<Place[]>([]);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setText(value?.name ?? "");
  }, [value]);

  function handleChange(v: string) {
    setText(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!v.trim()) {
      setOptions([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      const res = await fetch(`/api/place-search?q=${encodeURIComponent(v)}`);
      const data = await res.json();
      setOptions(data.places ?? []);
      setOpen(true);
    }, 300);
  }

  return (
    <div className="placeInput">
      <span className="dot" style={{ background: dotColor }} />
      <input
        className="placeInputField"
        placeholder={label}
        value={text}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => options.length > 0 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && options.length > 0 && (
        <ul className="placeDropdown">
          {options.map((p) => (
            <li
              key={`${p.x},${p.y}`}
              onMouseDown={() => {
                onSelect(p);
                setText(p.name);
                setOpen(false);
              }}
            >
              <div className="placeName">{p.name}</div>
              <div className="placeAddr">{p.address}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
