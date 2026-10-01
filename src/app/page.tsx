import { Container } from "@/components/ui/Container";

export default function Home() {
  return (
    <main className="flex-1 flex flex-col justify-center items-center py-24 px-6">
      <Container size="narrow" className="text-center space-y-12">
        <div className="space-y-4">
          <p className="text-xs uppercase tracking-[0.3em] text-neutral-400 font-mono">
            Phase 0 — Infrastructure Spike
          </p>
          <h1 className="text-4xl md:text-6xl font-light tracking-[0.2em] uppercase text-neutral-100">
            VÉRANE
          </h1>
          <p className="text-sm md:text-base uppercase tracking-[0.25em] text-amber-500/90 font-medium pt-2">
            Two Brands. One Expression.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-8 border-t border-neutral-800">
          <div className="p-6 bg-neutral-900/50 border border-neutral-800/80 rounded-sm text-left space-y-2">
            <h2 className="text-xs uppercase tracking-[0.2em] text-neutral-300 font-semibold">
              UTHY LUXURY
            </h2>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Couture, high fashion tailoring, and editorial luxury.
            </p>
          </div>
          <div className="p-6 bg-neutral-900/50 border border-neutral-800/80 rounded-sm text-left space-y-2">
            <h2 className="text-xs uppercase tracking-[0.2em] text-neutral-300 font-semibold">
              ALOMZIEE FOOTIES
            </h2>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Premium footwear, artisanal silhouettes, and modern statement pieces.
            </p>
          </div>
        </div>

        <div className="pt-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-900 border border-neutral-800 rounded-full text-xs text-neutral-400 font-mono">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Technical Foundation Active — Next.js 16 + Cloudflare Workers</span>
          </div>
        </div>
      </Container>
    </main>
  );
}
