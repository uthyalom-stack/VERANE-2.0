import React from "react";
import NextLink from "next/link";

interface LinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  children: React.ReactNode;
  variant?: "underline" | "subtle" | "button";
}

export function Link({ href, children, variant = "underline", className = "", ...props }: LinkProps) {
  const variants = {
    underline:
      "text-neutral-200 underline underline-offset-4 decoration-neutral-600 hover:decoration-neutral-200 transition-colors",
    subtle: "text-neutral-400 hover:text-neutral-100 transition-colors",
    button:
      "inline-flex items-center justify-center px-5 py-2.5 bg-neutral-100 text-neutral-900 hover:bg-neutral-300 text-sm font-medium tracking-wide uppercase transition-all",
  };

  return (
    <NextLink href={href} className={`${variants[variant]} ${className}`} {...props}>
      {children}
    </NextLink>
  );
}
