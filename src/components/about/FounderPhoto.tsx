// Founder portrait shown at the end of the About page story.
// The photo is a real file bundled with the site (not a Lovable-hosted link) so it
// works on the Cloudflare deployment.
import founderPhotoUrl from "@/assets/founder-yash.jpg";

const founderPhoto: string | null = founderPhotoUrl;

export function FounderPhoto() {
  return (
    <figure className="mx-auto w-full max-w-sm">
      {founderPhoto ? (
        <img
          src={founderPhoto}
          alt="Yash, founder of Hisaaboo"
          width={626}
          height={820}
          loading="lazy"
          decoding="async"
          className="aspect-[4/5] w-full rounded-3xl object-cover shadow-xl"
        />
      ) : (
        <div className="flex aspect-[4/5] w-full items-center justify-center rounded-3xl bg-gradient-to-br from-emerald-100 to-emerald-50 shadow-inner" role="img" aria-label="Yash, founder of Hisaaboo">
          <span className="text-8xl font-extrabold text-emerald-600/70" aria-hidden="true">Y</span>
        </div>
      )}
      <figcaption className="mt-4 text-center">
        <span className="block text-lg font-bold text-slate-900">Yash</span>
        <span className="block text-sm text-slate-500">Founder, Hisaaboo · Bijnor, Uttar Pradesh</span>
      </figcaption>
    </figure>
  );
}
