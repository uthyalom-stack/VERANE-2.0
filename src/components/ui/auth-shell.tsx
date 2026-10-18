export function AuthShell({ title, intro, children }: { title: string; intro?: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto grid min-h-[100svh] max-w-6xl items-center gap-12 px-5 pb-16 pt-28 md:grid-cols-2">
      <div><h1 className="display text-6xl md:text-8xl">{title}</h1>{intro && <p className="mt-6 text-muted">{intro}</p>}</div>
      <div className="glass rounded-[var(--r-lg)] p-6 md:p-10">{children}</div>
    </div>
  );
}
