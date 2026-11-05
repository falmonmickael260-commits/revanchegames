import Image from "next/image";
import type { CSSProperties } from "react";

export function GiftArt({ src, name, animation, animated = false, size = 72, animationDuration = 2400 }: {
  src: string; name: string; animation: string; animated?: boolean; size?: number; animationDuration?: number;
}) {
  return <span className={`rg-gift-art ${animated ? "is-animated" : ""}`} data-animation={animation}
    style={{ width: size, height: size, "--rg-gift-motion-duration": `${animationDuration}ms` } as CSSProperties}>
    <Image src={src} alt={name} fill sizes={`${size}px`} unoptimized className="object-contain" />
    {animated && <><i aria-hidden="true" /><i aria-hidden="true" /><i aria-hidden="true" /></>}
  </span>;
}
