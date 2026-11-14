/** Shop web-address rules shared by the onboarding form and tests. Must match the businesses.slug DB check. */
export const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,48}[a-z0-9])$/;

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50)
    .replace(/-+$/g, "");
}

export function isValidSlug(slug: string): boolean {
  return SLUG_PATTERN.test(slug);
}
