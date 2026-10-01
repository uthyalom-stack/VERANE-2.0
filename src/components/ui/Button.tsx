import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
  children: React.ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  children,
  className = "",
  ...props
}: ButtonProps) {
  const baseStyles =
    "inline-flex items-center justify-center font-medium tracking-wide uppercase transition-all duration-300 disabled:opacity-50 disabled:pointer-events-none cursor-pointer";

  const variants = {
    primary: "bg-neutral-100 text-neutral-900 hover:bg-neutral-300 border border-neutral-100",
    secondary: "bg-neutral-900 text-neutral-100 hover:bg-neutral-800 border border-neutral-800",
    outline: "bg-transparent text-neutral-100 border border-neutral-700 hover:border-neutral-300",
    ghost: "bg-transparent text-neutral-100 hover:bg-neutral-900",
  };

  const sizes = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-5 py-2.5 text-sm",
    lg: "px-8 py-3.5 text-base",
  };

  return (
    <button className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`} {...props}>
      {children}
    </button>
  );
}
