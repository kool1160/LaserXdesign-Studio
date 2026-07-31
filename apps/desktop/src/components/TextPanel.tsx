import type { TextObject } from "@laserx/domain";
import type { FontCatalogEntry, FontCategory } from "@laserx/fonts";
import {
  useEffect,
  useMemo,
  useState,
  type SyntheticEvent,
} from "react";

import type {
  CommandResult,
  DesktopState,
  TextLayoutRequestDto,
} from "../../electron/ipc-contract.js";

interface TextPanelProps {
  state: DesktopState;
  busy: boolean;
  run: (command: () => Promise<CommandResult>) => void;
}

const DEFAULT_FORM: TextLayoutRequestDto = {
  fontId: "bundled:noto-sans",
  content: "LaserX",
  sizeMm: 25,
  trackingMm: 0,
  wordSpacingMm: 0,
  lineSpacing: 1.2,
  alignment: "left",
  arc: null,
};
const CATEGORIES: FontCategory[] = [
  "stencil",
  "script",
  "serif",
  "slab",
  "western",
  "industrial",
  "display",
];

function readIds(key: string): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) ?? "[]") as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === "string")
      : [];
  } catch {
    return [];
  }
}

function selectedText(state: DesktopState): TextObject | null {
  if (state.editor.selectionIds.length !== 1) {
    return null;
  }
  const selected = state.project.document.objects.find(
    (object) => object.id === state.editor.selectionIds[0],
  );
  return selected?.type === "text" ? selected : null;
}

export function TextPanel({ state, busy, run }: TextPanelProps) {
  const [fonts, setFonts] = useState<FontCatalogEntry[]>([]);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [form, setForm] = useState<TextLayoutRequestDto>(DEFAULT_FORM);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<FontCategory | "all">("all");
  const [favorites, setFavorites] = useState<string[]>(() =>
    readIds("laserx.font-favorites"),
  );
  const [recent, setRecent] = useState<string[]>(() =>
    readIds("laserx.font-recent"),
  );
  const [preserveSource, setPreserveSource] = useState(true);
  const selected = selectedText(state);
  const selectedId = selected?.id;

  useEffect(() => {
    let active = true;
    void window.laserx
      .getFontCatalog()
      .then((catalog) => {
        if (active) {
          setFonts(catalog);
          setCatalogError(null);
          if (
            !catalog.some((font) => font.id === DEFAULT_FORM.fontId) &&
            catalog[0] !== undefined
          ) {
            const firstFont = catalog[0];
            setForm((current) => ({ ...current, fontId: firstFont.id }));
          }
        }
      })
      .catch(() => {
        if (active) {
          setCatalogError("The font catalog could not be loaded.");
        }
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (selected === null) {
      return;
    }
    setForm({
      fontId: selected.style.fontId,
      content: selected.content,
      sizeMm: selected.style.sizeMm,
      trackingMm: selected.style.trackingMm,
      wordSpacingMm: selected.style.wordSpacingMm,
      lineSpacing: selected.style.lineSpacing,
      alignment: selected.style.alignment,
      arc: selected.arc === null ? null : { ...selected.arc },
    });
  }, [selected?.id]);

  const availableSelectedFont = fonts.find(
    (font) =>
      font.id === selected?.style.fontId &&
      font.fingerprint === selected.style.fontFingerprint,
  );
  const visibleFonts = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase();
    return fonts.filter(
      (font) =>
        (category === "all" || font.categories.includes(category)) &&
        (needle.length === 0 ||
          `${font.family} ${font.style}`.toLocaleLowerCase().includes(needle)),
    );
  }, [category, fonts, search]);

  useEffect(() => {
    if (
      selectedId === undefined ||
      form.content.length === 0 ||
      form.sizeMm <= 0 ||
      form.lineSpacing <= 0 ||
      (form.arc !== null && form.arc.radiusMm <= 0)
    ) {
      return;
    }
    const timer = window.setTimeout(() => {
      run(() => window.laserx.updateSelectedText(form));
    }, 350);
    return () => window.clearTimeout(timer);
  }, [form, run, selectedId]);

  const rememberFont = (fontId: string) => {
    const next = [fontId, ...recent.filter((id) => id !== fontId)].slice(0, 8);
    setRecent(next);
    localStorage.setItem("laserx.font-recent", JSON.stringify(next));
  };
  const submit = (event: SyntheticEvent<HTMLFormElement>, update: boolean) => {
    event.preventDefault();
    rememberFont(form.fontId);
    run(() =>
      update
        ? window.laserx.updateSelectedText(form)
        : window.laserx.createText(form),
    );
  };
  const numeric = (
    key:
      | "sizeMm"
      | "trackingMm"
      | "wordSpacingMm"
      | "lineSpacing",
    value: string,
  ) => setForm((current) => ({ ...current, [key]: Number(value) }));

  return (
    <section className="text-panel" data-testid="text-panel">
      <span className="section-label">Text & fonts</span>
      {catalogError !== null && <p role="alert">{catalogError}</p>}
      {selected !== null && availableSelectedFont === undefined && (
        <p className="font-warning" data-testid="missing-font-warning">
          {selected.style.fontFamily} {selected.style.fontStyle} is missing or
          changed. Saved contours are preserved until you choose a substitute
          and update.
        </p>
      )}
      <label>
        Search fonts
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </label>
      <label>
        Category
        <select
          value={category}
          onChange={(event) =>
            setCategory(event.target.value as FontCategory | "all")
          }
        >
          <option value="all">All categories</option>
          {CATEGORIES.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </label>
      <form onSubmit={(event) => submit(event, selected !== null)}>
        <label>
          Font
          <span className="font-choice">
            <select
              data-testid="font-family"
              value={form.fontId}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  fontId: event.target.value,
                }))
              }
            >
              {visibleFonts.map((font) => (
                <option key={font.id} value={font.id}>
                  {favorites.includes(font.id) ? "★ " : ""}
                  {recent.includes(font.id) ? "Recent · " : ""}
                  {font.family} — {font.style} ({font.source})
                </option>
              ))}
            </select>
            <button
              type="button"
              aria-label="Toggle favorite font"
              onClick={() => {
                const next = favorites.includes(form.fontId)
                  ? favorites.filter((id) => id !== form.fontId)
                  : [...favorites, form.fontId];
                setFavorites(next);
                localStorage.setItem(
                  "laserx.font-favorites",
                  JSON.stringify(next),
                );
              }}
            >
              {favorites.includes(form.fontId) ? "★" : "☆"}
            </button>
          </span>
        </label>
        <label>
          Text
          <textarea
            data-testid="text-content"
            required
            maxLength={10_000}
            value={form.content}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                content: event.target.value,
              }))
            }
          />
        </label>
        <div className="text-number-grid">
          <label>
            Size (mm)
            <input
              type="number"
              min="0.01"
              step="any"
              value={form.sizeMm}
              onChange={(event) => numeric("sizeMm", event.target.value)}
            />
          </label>
          <label>
            Tracking (mm)
            <input
              type="number"
              step="any"
              value={form.trackingMm}
              onChange={(event) => numeric("trackingMm", event.target.value)}
            />
          </label>
          <label>
            Word space (mm)
            <input
              type="number"
              step="any"
              value={form.wordSpacingMm}
              onChange={(event) =>
                numeric("wordSpacingMm", event.target.value)
              }
            />
          </label>
          <label>
            Line spacing
            <input
              type="number"
              min="0.1"
              step="any"
              value={form.lineSpacing}
              onChange={(event) =>
                numeric("lineSpacing", event.target.value)
              }
            />
          </label>
        </div>
        <label>
          Alignment
          <select
            value={form.alignment}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                alignment: event.target.value as TextLayoutRequestDto["alignment"],
              }))
            }
          >
            <option value="left">Left</option>
            <option value="center">Center</option>
            <option value="right">Right</option>
          </select>
        </label>
        <label>
          <input
            type="checkbox"
            checked={form.arc !== null}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                arc: event.target.checked
                  ? {
                      radiusMm: 80,
                      startAngleDeg: -45,
                      clockwise: false,
                    }
                  : null,
              }))
            }
          />
          Arc text
        </label>
        {form.arc !== null && (
          <div className="text-number-grid">
            <label>
              Radius (mm)
              <input
                data-testid="arc-radius"
                type="number"
                min="0.01"
                step="any"
                value={form.arc.radiusMm}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    arc:
                      current.arc === null
                        ? null
                        : {
                            ...current.arc,
                            radiusMm: Number(event.target.value),
                          },
                  }))
                }
              />
            </label>
            <label>
              Start angle
              <input
                type="number"
                step="any"
                value={form.arc.startAngleDeg}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    arc:
                      current.arc === null
                        ? null
                        : {
                            ...current.arc,
                            startAngleDeg: Number(event.target.value),
                          },
                  }))
                }
              />
            </label>
            <label>
              <input
                type="checkbox"
                checked={form.arc.clockwise}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    arc:
                      current.arc === null
                        ? null
                        : { ...current.arc, clockwise: event.target.checked },
                  }))
                }
              />
              Clockwise
            </label>
          </div>
        )}
        <button
          type="submit"
          data-testid={selected === null ? "create-text" : "update-text"}
          disabled={busy || fonts.length === 0 || form.content.length === 0}
        >
          {selected === null ? "Create text" : "Update selected text"}
        </button>
        {selected !== null && (
          <small>Selected text updates live after a short pause.</small>
        )}
      </form>
      {selected !== null && (
        <div className="outline-conversion">
          <label>
            <input
              type="checkbox"
              checked={preserveSource}
              onChange={(event) => setPreserveSource(event.target.checked)}
            />
            Preserve editable source metadata
          </label>
          <button
            type="button"
            data-testid="convert-text-outlines"
            disabled={busy}
            onClick={() =>
              run(() =>
                window.laserx.editorAction({
                  type: "objects.convert-selected-text",
                  preserveSource,
                }),
              )
            }
          >
            Convert to outlines
          </button>
        </div>
      )}
    </section>
  );
}
