import { cn } from "@/lib/cn";
import { getDb } from "@/lib/server";
import { getSiteConfig } from "@/domains/site-content";

/** The hero artwork is selected in Admin → Site content & settings from the Media library. */
export async function EditorialImage({
  brand,
  alt,
  className,
  priority = false,
}: {
  brand: "uthy" | "alomzie";
  alt: string;
  className?: string;
  priority?: boolean;
}) {
  const config = await getSiteConfig(getDb());
  const src = config.heroImageUrls[brand];
  if (!src) return <div role="img" aria-label={alt} data-editorial-placeholder={brand} className={cn("h-full w-full bg-gradient-to-br from-neutral-900 via-neutral-700 to-neutral-950", className)} />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} loading={priority ? "eager" : "lazy"} decoding="async" fetchPriority={priority ? "high" : "auto"} className={cn("h-full w-full object-cover", className)} />;
}
