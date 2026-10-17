"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export type Tile = { id: string; title: string; href: string; node: React.ReactNode; wide?: boolean };

const KEY = "apex.layout.v1";

/**
 * Overview cards you can rearrange (drag the grip, or focus it and use arrow keys)
 * and open (click anywhere that isn't a control). Order is remembered in this browser.
 */
export function Board({ tiles }: { tiles: Tile[] }) {
  const router = useRouter();
  const ids = tiles.map((t) => t.id);
  const [order, setOrder] = useState<string[]>(ids);
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [announce, setAnnounce] = useState("");

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) ?? "null") as string[] | null;
      if (Array.isArray(saved)) {
        const known = saved.filter((id) => ids.includes(id));
        setOrder([...known, ...ids.filter((id) => !known.includes(id))]);
      }
    } catch {
      /* storage unavailable — keep default order */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function save(next: string[]) {
    setOrder(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }

  function move(id: string, to: number) {
    const next = order.filter((x) => x !== id);
    next.splice(Math.max(0, Math.min(next.length, to)), 0, id);
    save(next);
  }

  const byId = new Map(tiles.map((t) => [t.id, t]));
  const isDefault = order.join() === ids.join();

  return (
    <>
      <div className="grid-2">
        {order.map((id, idx) => {
          const t = byId.get(id)!;
          return (
            <div
              key={id}
              className={`tile${dragId === id && over ? " dragging" : ""}${over === id && dragId && dragId !== id ? " drop-target" : ""}`}
              style={t.wide ? { gridColumn: "1 / -1" } : undefined}
              data-tile={id}
              onClick={(e) => {
                const el = e.target as HTMLElement;
                if (el.closest("button, a, input, select, label, [role='switch'], [role='group'], [role='tooltip']")) return;
                router.push(t.href);
              }}
            >
              <div className="tile-tools">
                <button
                  type="button"
                  className="grip"
                  aria-label={`Move ${t.title}. Use arrow keys to reorder.`}
                  title="Drag to rearrange"
                  onPointerDown={(e) => {
                    // Pointer-based drag (mouse, pen, touch): follow the pointer, drop on the tile beneath it.
                    e.preventDefault();
                    e.currentTarget.setPointerCapture?.(e.pointerId);
                    setDragId(id);
                  }}
                  onPointerMove={(e) => {
                    if (dragId !== id) return;
                    const under = document.elementFromPoint(e.clientX, e.clientY)?.closest("[data-tile]") as HTMLElement | null;
                    const target = under?.dataset.tile ?? null;
                    setOver(target && target !== id ? target : null);
                  }}
                  onPointerUp={() => {
                    if (dragId === id && over) {
                      move(id, order.indexOf(over));
                      setAnnounce(`${t.title} moved`);
                    }
                    setDragId(null);
                    setOver(null);
                  }}
                  onPointerCancel={() => { setDragId(null); setOver(null); }}
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => {
                    if (["ArrowLeft", "ArrowUp"].includes(e.key) && idx > 0) {
                      e.preventDefault();
                      move(id, idx - 1);
                      setAnnounce(`${t.title} moved to position ${idx}`);
                    }
                    if (["ArrowRight", "ArrowDown"].includes(e.key) && idx < order.length - 1) {
                      e.preventDefault();
                      move(id, idx + 1);
                      setAnnounce(`${t.title} moved to position ${idx + 2}`);
                    }
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                    {[2, 6, 10].map((y) => [3, 9].map((x) => <circle key={`${x}${y}`} cx={x} cy={y} r="1.2" fill="currentColor" />))}
                  </svg>
                </button>
                <Link href={t.href}>details →</Link>
              </div>
              {t.node}
            </div>
          );
        })}
      </div>
      <div className="row between mono muted" style={{ fontSize: 11, marginTop: -8 }}>
        <span aria-live="polite">{announce || "drag ⠿ to rearrange · click a card for details"}</span>
        {!isDefault && (
          <button type="button" className="chip" style={{ minHeight: 28 }} onClick={() => save(ids)}>
            reset layout
          </button>
        )}
      </div>
    </>
  );
}
