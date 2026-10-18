import { mediaUrl } from "@/infrastructure/storage";
import { cn } from "@/lib/cn";

/** Single place that turns a stored asset into an <img>. Real photography replaces placeholders with no UI change. */
export function Media({ storageKey, alt, className, priority = false, sizes }: { storageKey: string; alt: string; className?: string; priority?: boolean; sizes?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={mediaUrl(storageKey)} alt={alt} sizes={sizes} loading={priority ? "eager" : "lazy"} decoding="async" fetchPriority={priority ? "high" : "auto"} className={cn("h-full w-full object-cover", className)} />
  );
}
