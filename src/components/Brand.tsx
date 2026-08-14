import Image from "next/image";
import Link from "next/link";

// The logo file is a full lockup — wordmark, BUFFET ART bar and the tagline —
// so it stands alone. Setting it beside a text "Banarasia Buffet Art" printed
// the name twice, which is why no caption is rendered here.
const LOGO_SRC = "/sample-caterer/tl.png";
const LOGO_RATIO = 739 / 338;

export default function Brand({
  size = "md",
  href = "/",
}: {
  size?: "sm" | "md" | "lg";
  href?: string | null;
}) {
  // Height drives the size; width follows the source ratio so the lockup never
  // squashes. The tagline is small in the artwork, so these run generous.
  const height = size === "lg" ? 72 : size === "sm" ? 40 : 56;
  const width = Math.round(height * LOGO_RATIO);

  const inner = (
    <Image
      src={LOGO_SRC}
      alt="Banarasia Buffet Art"
      width={width}
      height={height}
      className="object-contain"
      priority
    />
  );

  if (!href) return inner;
  return (
    <Link href={href} aria-label="Banarasia Buffet Art" className="inline-flex">
      {inner}
    </Link>
  );
}
