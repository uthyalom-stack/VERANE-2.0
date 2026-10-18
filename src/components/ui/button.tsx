import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

const base = "inline-flex min-h-11 items-center justify-center gap-2 px-6 text-sm font-medium transition-[background,color,transform] duration-[var(--dur-2)] ease-[var(--ease)] active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50 rounded-[var(--r-sm)]";
const variants = {
  solid: "bg-accent text-accent-fg hover:brightness-110",
  outline: "border border-line text-fg hover:bg-surface",
  glass: "glass text-fg hover:brightness-125 rounded-full",
  ghost: "text-fg hover:bg-surface",
};
type V = keyof typeof variants;
export function Button({ variant = "solid", className, ...p }: ComponentProps<"button"> & { variant?: V }) {
  return <button className={cn(base, variants[variant], className)} {...p} />;
}
export function ButtonLink({ variant = "solid", className, ...p }: ComponentProps<typeof Link> & { variant?: V }) {
  return <Link className={cn(base, variants[variant], className)} {...p} />;
}
