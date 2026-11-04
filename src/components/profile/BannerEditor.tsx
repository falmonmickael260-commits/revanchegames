"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Check, X } from "lucide-react";
import { useRouter } from "next/navigation";

const WIDTH = 1000;
const HEIGHT = 375;

export function BannerEditor({ initialUrl }: { initialUrl: string | null }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [url, setUrl] = useState(initialUrl);
  const [file, setFile] = useState<File | null>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [positionX, setPositionX] = useState(50);
  const [positionY, setPositionY] = useState(50);
  const [zoom, setZoom] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!file) return;
    const objectUrl = URL.createObjectURL(file);
    const next = new window.Image();
    next.onload = () => setImage(next);
    next.onerror = () => setError("Impossible de lire cette image.");
    next.src = objectUrl;
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  useEffect(() => {
    if (!image || !canvas.current) return;
    const context = canvas.current.getContext("2d");
    if (!context) return;
    const ratio = WIDTH / HEIGHT;
    const baseWidth = Math.min(image.naturalWidth, image.naturalHeight * ratio);
    const baseHeight = baseWidth / ratio;
    const cropWidth = baseWidth / zoom;
    const cropHeight = baseHeight / zoom;
    const x = (image.naturalWidth - cropWidth) * positionX / 100;
    const y = (image.naturalHeight - cropHeight) * positionY / 100;
    context.clearRect(0, 0, WIDTH, HEIGHT);
    context.drawImage(image, x, y, cropWidth, cropHeight, 0, 0, WIDTH, HEIGHT);
  }, [image, positionX, positionY, zoom]);

  function choose(next: File | undefined) {
    if (!next) return;
    if (!next.type.startsWith("image/") || next.size > 10 * 1024 * 1024) {
      setError("Choisis une image de moins de 10 Mo.");
      return;
    }
    setError(""); setImage(null); setFile(next); setPositionX(50); setPositionY(50); setZoom(1);
  }

  async function save() {
    if (!canvas.current || busy) return;
    setBusy(true); setError("");
    const blob = await new Promise<Blob | null>(resolve => canvas.current?.toBlob(resolve, "image/webp", 0.88));
    if (!blob) { setBusy(false); setError("Recadrage impossible."); return; }
    const form = new FormData();
    form.append("file", blob, "banniere.webp");
    try {
      const response = await fetch("/api/profile/banner", { method: "POST", body: form });
      const result = await response.json() as { url?: string; error?: string };
      if (!response.ok || !result.url) throw new Error(result.error ?? "Envoi impossible.");
      setUrl(result.url); setFile(null); setImage(null); router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Envoi impossible.");
    } finally { setBusy(false); }
  }

  return <>
    <div className="rg-profile-banner" style={url ? { backgroundImage: `linear-gradient(0deg,#0d1420aa,transparent 72%),url(${JSON.stringify(url)})` } : undefined}>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="sr-only" onChange={event => { choose(event.target.files?.[0]); event.target.value = ""; }} aria-label="Choisir une bannière" />
      <button type="button" onClick={() => input.current?.click()}><Camera size={15} /> {url ? "Changer la couverture" : "Ajouter une couverture"}</button>
    </div>
    {file && <div className="rg-banner-modal" role="dialog" aria-modal="true" aria-label="Recadrer la bannière">
      <div className="rg-banner-dialog">
        <div className="rg-banner-dialog-heading"><h2>Recadrer la couverture</h2><button type="button" aria-label="Fermer" onClick={() => { setFile(null); setImage(null); }}><X size={20} /></button></div>
        <canvas ref={canvas} width={WIDTH} height={HEIGHT} className="rg-banner-canvas" aria-label="Aperçu du recadrage" />
        <label>Déplacer horizontalement<input type="range" min="0" max="100" value={positionX} onChange={event => setPositionX(Number(event.target.value))} /></label>
        <label>Déplacer verticalement<input type="range" min="0" max="100" value={positionY} onChange={event => setPositionY(Number(event.target.value))} /></label>
        <label>Zoom<input type="range" min="1" max="2.5" step="0.01" value={zoom} onChange={event => setZoom(Number(event.target.value))} /></label>
        {error && <p role="alert" className="rg-banner-error">{error}</p>}
        <button type="button" className="rg-primary-button" onClick={() => void save()} disabled={!image || busy}><Check size={17} /> {busy ? "Envoi…" : "Enregistrer la couverture"}</button>
      </div>
    </div>}
  </>;
}
