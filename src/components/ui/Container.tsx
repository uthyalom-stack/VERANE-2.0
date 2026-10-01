import React from "react";

interface ContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  size?: "narrow" | "default" | "wide" | "full";
}

export function Container({ children, size = "default", className = "", ...props }: ContainerProps) {
  const maxWidths = {
    narrow: "max-w-4xl",
    default: "max-w-7xl",
    wide: "max-w-8xl",
    full: "max-w-full",
  };

  return (
    <div className={`mx-auto px-4 sm:px-6 lg:px-8 ${maxWidths[size]} ${className}`} {...props}>
      {children}
    </div>
  );
}
