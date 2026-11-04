import Image from "next/image";

export function GiftArt({ src, name, animation, animated = false, size = 72 }: {
  src: string; name: string; animation: string; animated?: boolean; size?: number;
}) {
  return <span className={`rg-gift-art ${animated ? "is-animated" : ""}`} data-animation={animation}
    style={{ width: size, height: size }}>
    <Image src={src} alt={name} fill sizes={`${size}px`} unoptimized className="object-contain" />
    {animated && <><i aria-hidden="true" /><i aria-hidden="true" /><i aria-hidden="true" /></>}
  </span>;
}
