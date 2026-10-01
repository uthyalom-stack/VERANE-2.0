import React from "react";

interface MediaProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  aspectRatio?: "square" | "portrait" | "landscape" | "auto";
}

export function Media({ src, alt, aspectRatio = "auto", className = "", ...props }: MediaProps) {
  const aspectClasses = {
    square: "aspect-square object-cover",
    portrait: "aspect-[3/4] object-cover",
    landscape: "aspect-[16/9] object-cover",
    auto: "",
  };

  return (
    <div className="overflow-hidden bg-neutral-900">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className={`w-full h-full transition-transform duration-700 hover:scale-105 ${aspectClasses[aspectRatio]} ${className}`}
        loading="lazy"
        {...props}
      />
    </div>
  );
}
