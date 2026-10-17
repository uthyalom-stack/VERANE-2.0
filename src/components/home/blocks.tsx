import Link from "next/link";
import { Media } from "@/components/ui/media";
import { ButtonLink } from "@/components/ui/button";
import { ProductCard } from "@/components/commerce/product-card";
import { listShopProducts, toCardData, listBrands } from "@/domains/catalog/public";
import { getCollection, listLooks, listArticles, getActiveCampaign } from "@/domains/content/public";
import { mediaUrl } from "@/infrastructure/storage";
import { HeroVideo } from "./hero-video";
import type { Db } from "@/infrastructure/db/client";
import { NewsletterSignup } from "./newsletter";

type Block = { id: string; type: string; data: Record<string, unknown> };
const str = (v: unknown, d = "") => (typeof v === "string" ? v : d);

/** Block registry: the CMS stores `type` + `data`; unknown types are skipped, never crash the page. */
export async function HomeBlocks({ db, blocks }: { db: Db; blocks: Block[] }) {
  const brands = await listBrands(db);
  return (
    <>
      {await Promise.all(blocks.map(async (b) => {
        switch (b.type) {
          case "campaign_hero": return <CampaignHero key={b.id} db={db} data={b.data} />;
          case "hero": return <SplitHero key={b.id} data={b.data} brands={brands} />;
          case "brand_intro": return <BrandIntro key={b.id} brands={brands} />;
          case "product_rail": return <ProductRail key={b.id} db={db} data={b.data} />;
          case "outfit_builder_intro": return <BuilderIntro key={b.id} />;
          case "newsletter": return <NewsletterSignup key={b.id} />;
          case "collection_feature": return <CollectionFeature key={b.id} db={db} data={b.data} />;
          case "look_feature": return <LookFeature key={b.id} db={db} data={b.data} />;
          case "editorial_rail": return <EditorialRail key={b.id} db={db} data={b.data} />;
          case "promo": return <Promo key={b.id} data={b.data} />;
          default: return null;
        }
      }))}
    </>
  );
}

function SplitHero({ data, brands }: { data: Record<string, unknown>; brands: Awaited<ReturnType<typeof listBrands>> }) {
  const heroKey: Record<string, string> = { uthy: "placeholders/uthy-hero.svg", alomzie: "placeholders/alomzie-hero.svg" };
  const copy: Record<string, { index: string; mood: string; action: string }> = {
    uthy: { index: "01", mood: "Quiet confidence. Considered form.", action: "Enter the house" },
    alomzie: { index: "02", mood: "Make the entrance yours.", action: "Explore the collection" },
  };
  return (
    <section aria-label="The VÉRANE fashion house" className="house-hero relative">
      <div className="split-hero">
        {brands.map((b) => {
          const editorial = copy[b.themeKey] ?? copy.uthy!;
          return (
            <Link key={b.id} href={`/brands/${b.slug}`} data-brand={b.themeKey} className="house-panel group">
              <Media storageKey={heroKey[b.themeKey] ?? "placeholders/uthy-hero.svg"} alt={`${b.name} campaign placeholder artwork`} priority className="house-panel__image absolute inset-0 opacity-70 transition-transform duration-[1200ms] ease-[var(--ease)] group-hover:scale-105" />
              <div aria-hidden="true" className="house-panel__shade absolute inset-0" />
              <div className="house-panel__meta absolute inset-x-6 top-24 z-10 flex items-center justify-between text-[10px] uppercase tracking-[0.22em] text-white/75 md:inset-x-10 md:top-28">
                <span>VÉRANE / {editorial.index}</span><span>{b.themeKey === "uthy" ? "The art of restraint" : "Unapologetic expression"}</span>
              </div>
              <div className="house-panel__copy relative z-10 flex h-full min-h-[50svh] flex-col justify-end p-6 pb-10 md:p-10 md:pb-14">
                <p className="mb-4 text-xs uppercase tracking-[0.2em] text-white/75">{editorial.mood}</p>
                <h2 className="display max-w-[10ch] text-[clamp(2.6rem,5.8vw,6.8rem)] leading-[0.88] text-white">{b.name}</h2>
                <p className="mt-4 max-w-sm text-sm text-white/75 md:text-base">{b.tagline}</p>
                <span className="house-panel__link mt-7 inline-flex w-fit items-center gap-4 border-b border-white/70 pb-2 text-xs uppercase tracking-[0.18em] text-white">
                  {editorial.action}<span aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-2">↗</span>
                </span>
              </div>
            </Link>
          );
        })}
      </div>
      <div className="house-hero__statement pointer-events-none absolute inset-x-0 top-1/2 z-20 hidden -translate-y-1/2 justify-center px-8 lg:flex">
        <div className="house-hero__glass pointer-events-auto max-w-3xl rounded-[2rem] border border-white/25 bg-black/25 px-7 py-9 text-center shadow-[0_24px_90px_rgba(0,0,0,0.28)] backdrop-blur-2xl md:px-14 md:py-12">
          <p className="mb-5 text-[10px] uppercase tracking-[0.35em] text-white/75">An independent digital fashion house</p>
          <h1 className="display text-[clamp(3.4rem,7vw,7.5rem)] leading-[0.86] text-white">{str(data.title, "Two Brands. One Expression.")}</h1>
          <p className="mx-auto mt-6 max-w-md text-sm leading-relaxed text-white/75">{str(data.subtitle, "Two distinct creative worlds. One considered point of view.")}</p>
          <ButtonLink href={str(data.ctaHref, "/shop")} variant="solid" className="mt-8">{str(data.ctaLabel, "Discover the house")}</ButtonLink>
        </div>
      </div>
      <div className="house-hero__mobile-statement px-6 pb-10 pt-9 lg:hidden">
        <p className="mb-4 text-[10px] uppercase tracking-[0.28em] text-muted">An independent digital fashion house</p>
        <h1 className="display max-w-[12ch] text-[clamp(2.8rem,12vw,5.5rem)] leading-[0.88]">{str(data.title, "Two Brands. One Expression.")}</h1>
        <p className="mt-5 max-w-md text-sm leading-relaxed text-muted">{str(data.subtitle, "Two distinct creative worlds. One considered point of view.")}</p>
        <ButtonLink href={str(data.ctaHref, "/shop")} variant="solid" className="mt-6">{str(data.ctaLabel, "Discover the house")}</ButtonLink>
      </div>
    </section>
  );
}
function BrandIntro({ brands }: { brands: Awaited<ReturnType<typeof listBrands>> }) {
  return (
    <section className="mx-auto mt-28 grid max-w-[1600px] gap-16 px-5 md:grid-cols-2 md:px-10">
      {brands.map((b, i) => (
        <div key={b.id} data-brand={b.themeKey} className={i % 2 ? "md:mt-24" : ""}>
          <h2 className="display text-5xl text-fg md:text-6xl">{b.name}</h2>
          <p className="mt-4 text-muted">{b.description}</p>
          <ButtonLink href={`/brands/${b.slug}`} variant="outline" className="mt-6">Enter {b.name}</ButtonLink>
        </div>
      ))}
    </section>
  );
}

async function ProductRail({ db, data }: { db: Db; data: Record<string, unknown> }) {
  const { items } = await listShopProducts(db, { sort: data.source === "newest" ? "newest" : "featured", pageSize: Math.min(Number(data.limit) || 8, 24) });
  if (!items.length) return null;
  const cards = await toCardData(db, items);
  return (
    <section aria-label={str(data.title, "Products")} className="mx-auto mt-28 max-w-[1600px] px-5 md:px-10">
      <div className="mb-8 flex items-end justify-between"><h2 className="display text-4xl md:text-5xl">{str(data.title, "New arrivals")}</h2><Link href="/shop?sort=newest" className="text-sm underline underline-offset-4">View all</Link></div>
      <div className="rail">{cards.map((c) => <ProductCard key={c.product.id} item={c} />)}</div>
    </section>
  );
}

function BuilderIntro() {
  return (
    <section className="mx-auto mt-28 max-w-[1600px] px-5 md:px-10"><div className="glass grid gap-6 rounded-[var(--r-lg)] p-8 md:grid-cols-2 md:p-14">
      <h2 className="display text-5xl md:text-7xl">Build your outfit</h2>
      <div><p className="text-muted">Mix pieces from both houses, choose sizes, see the total, and save the look for later.</p><ButtonLink href="/outfit-builder" className="mt-6">Open the Outfit Builder</ButtonLink></div></div></section>
  );
}
function Promo({ data }: { data: Record<string, unknown> }) {
  return <section className="mx-auto mt-28 max-w-[1600px] px-5 md:px-10"><div className="rounded-[var(--r-lg)] bg-accent p-10 text-accent-fg md:p-16"><h2 className="display text-4xl md:text-6xl">{str(data.title)}</h2>{str(data.body) && <p className="mt-3">{str(data.body)}</p>}{str(data.ctaHref) && <ButtonLink href={str(data.ctaHref)} variant="outline" className="mt-6 border-current text-current">{str(data.ctaLabel, "Learn more")}</ButtonLink>}</div></section>;
}
async function CollectionFeature({ db, data }: { db: Db; data: Record<string, unknown> }) {
  const c = await getCollection(db, str(data.slug)); if (!c) return null;
  return (
    <section className="mx-auto mt-28 max-w-[1600px] px-5 md:px-10"><div className="mb-8 flex items-end justify-between"><h2 className="display text-4xl md:text-5xl">{c.collection.title}</h2><Link href={`/collections/${c.collection.slug}`} className="text-sm underline underline-offset-4">View collection</Link></div>
      <div className="rail">{c.cards.slice(0, 8).map((x) => <ProductCard key={x.product.id} item={x} />)}</div></section>
  );
}
async function LookFeature({ db, data }: { db: Db; data: Record<string, unknown> }) {
  const l = (await listLooks(db)).find((x) => x.look.slug === str(data.slug)) ?? (await listLooks(db))[0]; if (!l) return null;
  return (
    <section className="mx-auto mt-28 grid max-w-[1600px] gap-8 px-5 md:grid-cols-2 md:px-10" data-brand={l.brand.themeKey}>
      <div className="aspect-[4/5] overflow-hidden rounded-[var(--r-md)] bg-surface">{l.image && <Media storageKey={l.image.storageKey} alt={l.image.altText ?? l.look.title} />}</div>
      <div className="self-center"><p className="text-sm text-muted">Shop the Look · {l.brand.name}</p><h2 className="display mt-2 text-5xl md:text-7xl">{l.look.title}</h2>{l.look.description && <p className="mt-4 text-muted">{l.look.description}</p>}<ButtonLink href={`/looks/${l.look.slug}`} className="mt-6">Shop this look</ButtonLink></div></section>
  );
}
async function EditorialRail({ db, data }: { db: Db; data: Record<string, unknown> }) {
  const list = await listArticles(db, { limit: Math.min(Number(data.limit) || 3, 6) }); if (!list.length) return null;
  return (
    <section className="mx-auto mt-28 max-w-[1600px] px-5 md:px-10"><div className="mb-8 flex items-end justify-between"><h2 className="display text-4xl md:text-5xl">{str(data.title, "From the Journal")}</h2><Link href="/journal" className="text-sm underline underline-offset-4">All stories</Link></div>
      <div className="grid gap-6 md:grid-cols-3">{list.map(({ article, cover }) => <Link key={article.id} href={`/journal/${article.slug}`} className="group"><div className="aspect-[4/3] overflow-hidden rounded-[var(--r-md)] bg-surface">{cover && <Media storageKey={cover.storageKey} alt={cover.altText ?? article.title} className="transition-transform duration-[var(--dur-3)] group-hover:scale-105" />}</div><p className="mt-3 text-xs text-muted">{article.kind.replace(/_/g, " ")}</p><h3 className="mt-1 text-2xl leading-tight">{article.title}</h3></Link>)}</div></section>
  );
}

async function CampaignHero({ db, data }: { db: Db; data: Record<string, unknown> }) {
  const c = await getActiveCampaign(db, str(data.slug)); if (!c || !c.hero) return null;
  const { campaign: k, hero, mobile, poster } = c;
  return (
    <section aria-label={k.title} className="relative isolate flex min-h-[100svh] items-end overflow-hidden">
      {hero.kind === "video"
        ? <HeroVideo src={mediaUrl(hero.storageKey)} mime={hero.mimeType} poster={poster ? mediaUrl(poster.storageKey) : undefined} label={hero.altText ?? k.title} />
        : <picture>{mobile && <source media="(max-width: 767px)" srcSet={mediaUrl(mobile.storageKey)} />}{/* eslint-disable-next-line @next/next/no-img-element */}<img src={mediaUrl(hero.storageKey)} alt={hero.altText ?? k.title} fetchPriority="high" className="absolute inset-0 -z-10 h-full w-full object-cover" /></picture>}
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/70 via-black/10 to-black/30" />
      <div className="mx-auto w-full max-w-[1600px] px-5 pb-16 md:px-10 md:pb-24"><h1 className="display text-[clamp(3rem,11vw,11rem)]">{k.title}</h1>{k.subtitle && <p className="mt-4 max-w-xl text-lg text-fg/80">{k.subtitle}</p>}{k.ctaHref && <ButtonLink href={k.ctaHref} className="mt-8">{k.ctaLabel ?? "Discover"}</ButtonLink>}</div>
    </section>
  );
}
