"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, RotateCw, X, ZoomIn } from "lucide-react";

/** Côté de l'image produite, en pixels. Doit rester ≥ à l'affichage le plus grand. */
const OUTPUT_SIZE = 512;
const MIN_ZOOM = 1;
const MAX_ZOOM = 4;

type Point = { x: number; y: number };

/**
 * Recadrage d'une photo de profil : zoom, déplacement, rotation par quarts.
 *
 * Écrit à la main plutôt qu'avec une bibliothèque : le besoin est un carré,
 * et une dépendance de recadrage pèse plus lourd que ces quelques dizaines de
 * lignes. Le geste est le même à la souris et au doigt (`pointer` events), et
 * le pincement à deux doigts est géré pour le zoom.
 *
 * Ce que produit ce composant n'est pas le fichier d'origine mais un carré
 * réencodé depuis les pixels affichés. Deux conséquences utiles : l'image
 * envoyée est petite, et elle ne transporte plus les métadonnées EXIF de la
 * photo d'origine — dont la géolocalisation. Le serveur refait néanmoins le
 * même travail de son côté : ce composant est un confort, pas une sécurité.
 */
export function AvatarCropper({
  file,
  onCancel,
  onCropped,
  busy = false,
  error = "",
}: {
  file: File;
  onCancel: () => void;
  onCropped: (blob: Blob) => void;
  busy?: boolean;
  error?: string;
}) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [loadError, setLoadError] = useState("");
  const [zoom, setZoom] = useState(1);
  const [quarters, setQuarters] = useState(0); // rotation, par quarts de tour
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });

  const frameRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ pointerId: number; start: Point; origin: Point } | null>(null);
  // Distance entre deux doigts au début du pincement, pour le zoom tactile.
  const pinchRef = useRef<{ distance: number; zoom: number } | null>(null);
  const pointersRef = useRef<Map<number, Point>>(new Map());

  // Chargement de l'image choisie.
  useEffect(() => {
    const url = URL.createObjectURL(file);
    const element = new Image();
    element.onload = () => setImage(element);
    element.onerror = () => setLoadError("Impossible de lire cette image.");
    element.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Dimensions apparentes de l'image une fois pivotée : un quart de tour
  // échange largeur et hauteur.
  const swapped = quarters % 2 === 1;
  const naturalW = image ? (swapped ? image.naturalHeight : image.naturalWidth) : 0;
  const naturalH = image ? (swapped ? image.naturalWidth : image.naturalHeight) : 0;

  /**
   * Empêche de sortir l'image du cadre : on borne le déplacement à la marge
   * réellement disponible, pour qu'aucun bord vide n'apparaisse.
   */
  const clamp = useCallback(
    (next: Point, currentZoom: number): Point => {
      if (!naturalW || !naturalH) return next;

      // Le carré est rempli par le petit côté (comme `object-fit: cover`),
      // puis agrandi du zoom. `coverW`/`coverH` sont les dimensions de
      // l'image en fraction du cadre ; la marge déplaçable est ce qui dépasse,
      // réparti de part et d'autre.
      const ratio = naturalW / naturalH;
      const coverW = ratio >= 1 ? ratio : 1;
      const coverH = ratio >= 1 ? 1 : 1 / ratio;
      const maxX = Math.max(0, (coverW * currentZoom - 1) / 2);
      const maxY = Math.max(0, (coverH * currentZoom - 1) / 2);

      return {
        x: Math.min(maxX, Math.max(-maxX, next.x)),
        y: Math.min(maxY, Math.max(-maxY, next.y)),
      };
    },
    [naturalW, naturalH],
  );

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    (event.target as Element).setPointerCapture?.(event.pointerId);
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointersRef.current.size === 2) {
      const [a, b] = [...pointersRef.current.values()];
      pinchRef.current = { distance: Math.hypot(a.x - b.x, a.y - b.y), zoom };
      dragRef.current = null;
      return;
    }

    dragRef.current = {
      pointerId: event.pointerId,
      start: { x: event.clientX, y: event.clientY },
      origin: offset,
    };
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!pointersRef.current.has(event.pointerId)) return;
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    // Pincement à deux doigts : zoom.
    if (pointersRef.current.size === 2 && pinchRef.current) {
      const [a, b] = [...pointersRef.current.values()];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      const next = Math.min(
        MAX_ZOOM,
        Math.max(MIN_ZOOM, (pinchRef.current.zoom * distance) / pinchRef.current.distance),
      );
      setZoom(next);
      setOffset((previous) => clamp(previous, next));
      return;
    }

    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const frame = frameRef.current;
    if (!frame) return;

    const size = frame.clientWidth || 1;
    setOffset(
      clamp(
        {
          x: drag.origin.x + (event.clientX - drag.start.x) / size,
          y: drag.origin.y + (event.clientY - drag.start.y) / size,
        },
        zoom,
      ),
    );
  }

  function handlePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    pointersRef.current.delete(event.pointerId);
    if (pointersRef.current.size < 2) pinchRef.current = null;
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
  }

  function changeZoom(next: number) {
    const clampedZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next));
    setZoom(clampedZoom);
    setOffset((previous) => clamp(previous, clampedZoom));
  }

  function rotate() {
    setQuarters((value) => (value + 1) % 4);
    // Après rotation, le cadrage précédent n'a plus de sens.
    setOffset({ x: 0, y: 0 });
    setZoom(1);
  }

  /**
   * Reproduit sur un canvas exactement ce que montre le cadre : même
   * rotation, même zoom, même décalage.
   */
  function confirm() {
    if (!image) return;
    const canvas = document.createElement("canvas");
    canvas.width = OUTPUT_SIZE;
    canvas.height = OUTPUT_SIZE;
    const context = canvas.getContext("2d");
    if (!context) return;

    context.imageSmoothingQuality = "high";
    context.fillStyle = "#0e1322";
    context.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);

    // Le carré est rempli par le petit côté, comme `object-fit: cover`.
    const ratio = naturalW / naturalH;
    const drawW = (ratio >= 1 ? ratio : 1) * OUTPUT_SIZE * zoom;
    const drawH = (ratio >= 1 ? 1 : 1 / ratio) * OUTPUT_SIZE * zoom;
    const left = (OUTPUT_SIZE - drawW) / 2 + offset.x * OUTPUT_SIZE;
    const top = (OUTPUT_SIZE - drawH) / 2 + offset.y * OUTPUT_SIZE;

    context.save();
    if (quarters !== 0) {
      context.translate(OUTPUT_SIZE / 2, OUTPUT_SIZE / 2);
      context.rotate((quarters * Math.PI) / 2);
      context.translate(-OUTPUT_SIZE / 2, -OUTPUT_SIZE / 2);
    }
    // Les dimensions passées à drawImage sont celles de l'image *pivotée* :
    // quand les côtés sont échangés, on dessine dans le repère tourné.
    if (swapped) {
      context.drawImage(image, top, left, drawH, drawW);
    } else {
      context.drawImage(image, left, top, drawW, drawH);
    }
    context.restore();

    canvas.toBlob(
      (blob) => {
        if (blob) onCropped(blob);
      },
      "image/webp",
      0.9,
    );
  }

  const ratio = naturalW && naturalH ? naturalW / naturalH : 1;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Recadrer la photo"
      className="fixed inset-0 z-[70] flex items-end justify-center bg-void/80 p-3 backdrop-blur-sm sm:items-center"
    >
      <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-4 shadow-[0_12px_48px_rgba(0,0,0,0.6)]">
        <header className="flex items-center justify-between gap-2">
          <p className="font-display text-sm font-semibold text-text">Recadrer la photo</p>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Annuler"
            className="rounded-lg p-1 text-text-faint hover:text-text"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        {loadError ? (
          <p className="mt-4 font-body text-sm text-violet-soft">{loadError}</p>
        ) : !image ? (
          <div className="mt-4 aspect-square w-full animate-pulse rounded-full bg-surface-raised" />
        ) : (
          <>
            {/* Cadre de recadrage. `touch-none` est indispensable : sans lui,
                le navigateur interprète le glissement comme un défilement de
                page et le déplacement de l'image ne fonctionne pas au doigt. */}
            <div
              ref={frameRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              className="relative mt-4 aspect-square w-full cursor-grab touch-none overflow-hidden rounded-full border-2 border-cyan/40 bg-void active:cursor-grabbing"
            >
              {/* `next/image` n'a pas sa place ici : la source est une URL
                  d'objet locale, jamais servie par le réseau, et l'image est
                  pilotée au pixel par des transformations CSS que l'optimiseur
                  casserait. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={image.src}
                alt=""
                draggable={false}
                className="pointer-events-none absolute left-1/2 top-1/2 max-w-none select-none"
                style={{
                  width: `${(ratio >= 1 ? ratio : 1) * 100 * zoom}%`,
                  height: `${(ratio >= 1 ? 1 : 1 / ratio) * 100 * zoom}%`,
                  transform: `translate(calc(-50% + ${offset.x * 100}%), calc(-50% + ${offset.y * 100}%)) rotate(${quarters * 90}deg)`,
                }}
              />
            </div>

            <p className="mt-2 text-center font-body text-[11px] text-text-faint">
              Fais glisser pour cadrer, pince ou utilise le curseur pour zoomer.
            </p>

            <div className="mt-3 flex items-center gap-3">
              <ZoomIn className="h-4 w-4 shrink-0 text-text-faint" />
              <input
                type="range"
                min={MIN_ZOOM}
                max={MAX_ZOOM}
                step={0.01}
                value={zoom}
                onChange={(event) => changeZoom(Number(event.target.value))}
                aria-label="Zoom"
                className="h-1.5 w-full flex-1 cursor-pointer appearance-none rounded-full bg-surface-raised accent-cyan"
              />
              <button
                type="button"
                onClick={rotate}
                aria-label="Pivoter d'un quart de tour"
                className="shrink-0 rounded-lg border border-border-soft p-1.5 text-text-dim transition-colors hover:text-text"
              >
                <RotateCw className="h-4 w-4" />
              </button>
            </div>

            {error && <p className="mt-3 font-body text-xs text-violet-soft">{error}</p>}

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={confirm}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-cyan to-violet px-4 py-2.5 font-display text-sm font-semibold text-void disabled:opacity-50"
              >
                <Check className="h-4 w-4" />
                {busy ? "Envoi…" : "Utiliser cette photo"}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={onCancel}
                className="rounded-lg border border-border-soft px-4 py-2.5 font-display text-sm font-semibold text-text-dim disabled:opacity-50"
              >
                Annuler
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
