"use client";
import { useEffect, useRef, useState } from "react";

/** Cinematic hero film. Muted/looping/inline; honours prefers-reduced-motion (shows the poster, no autoplay) and offers a pause control. */
export function HeroVideo({ src, mime, poster, label }: { src: string; mime: string; poster?: string; label: string }) {
  const ref = useRef<HTMLVideoElement>(null); const [playing, setPlaying] = useState(false);
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches; const v = ref.current; if (!v || reduce) return;
    v.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
  }, []);
  return (
    <>
      <video ref={ref} muted loop playsInline preload="metadata" poster={poster} aria-label={label} className="absolute inset-0 -z-10 h-full w-full object-cover"><source src={src} type={mime} /></video>
      <button type="button" onClick={() => { const v = ref.current; if (!v) return; if (v.paused) { void v.play(); setPlaying(true); } else { v.pause(); setPlaying(false); } }} className="glass absolute bottom-6 right-6 min-h-11 rounded-full px-4 text-sm" aria-label={playing ? "Pause background film" : "Play background film"}>{playing ? "Pause" : "Play"}</button>
    </>
  );
}
