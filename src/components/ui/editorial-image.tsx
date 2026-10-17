import { cn } from "@/lib/cn";

/**
 * Temporary, commercially reusable editorial direction imagery from Unsplash.
 * Replace these with VÉRANE-owned campaign assets before the final production launch.
 * Sources and license notes live in docs/EDITORIAL_ASSETS.md.
 */
export const HOUSE_EDITORIAL_IMAGES = {
  uthy: "https://images.unsplash.com/photo-1776273920158-510b171e936f?auto=format&fit=crop&fm=jpg&q=82&w=1800",
  alomzie: "https://images.unsplash.com/photo-1777899051916-067557782b78?auto=format&fit=crop&fm=jpg&q=82&w=1800",
} as const;

export function EditorialImage({
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
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={HOUSE_EDITORIAL_IMAGES[brand]}
      alt={alt}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      fetchPriority={priority ? "high" : "auto"}
      className={cn("h-full w-full object-cover", className)}
    />
  );
}
