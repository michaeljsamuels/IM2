/** Shared helpers for the HTML templates. */

export const LOCALES = ['en', 'fr'];

/** Localized URL for each static page, keyed by route id. */
export const ROUTES = {
  home: { en: '/en/', fr: '/fr/' },
  sale: { en: '/en/listings/sale/', fr: '/fr/annonces/vente/' },
  rent: { en: '/en/listings/rent/', fr: '/fr/annonces/location/' },
  commercialSale: { en: '/en/commercial/sale/', fr: '/fr/commercial/vente/' },
  commercialRent: { en: '/en/commercial/rent/', fr: '/fr/commercial/location/' },
  sold: { en: '/en/sold-properties/', fr: '/fr/proprietes-vendues/' },
  team: { en: '/en/our-team/', fr: '/fr/notre-equipe/' },
  contact: { en: '/en/contact/', fr: '/fr/contact/' },
};

export function esc(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export function slugify(s) {
  return String(s)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function listingUrl(listing, locale) {
  const base = locale === 'fr' ? '/fr/propriete' : '/en/listing';
  return `${base}/${listing.id}/${slugify(listing.address)}/`;
}

export function agentUrl(agent, locale) {
  return `${ROUTES.team[locale]}${agent.id}/`;
}

/** "1 150 000 $" (fr) / "$1,150,000" (en); appends /month for rentals. */
export function fmtPrice(listing, locale, strings) {
  const n = listing.price;
  const formatted =
    locale === 'fr'
      ? `${n.toLocaleString('fr-CA')} $`
      : `$${n.toLocaleString('en-CA')}`;
  return listing.status === 'for-rent' || listing.status === 'rented'
    ? `${formatted}${strings['card.perMonth'][locale]}`
    : formatted;
}

export function fmtMoney(n, locale) {
  if (n == null) return null;
  return locale === 'fr' ? `${n.toLocaleString('fr-CA')} $` : `$${n.toLocaleString('en-CA')}`;
}

export function fmtArea(area, locale) {
  if (!area) return null;
  const v = area.value.toLocaleString(locale === 'fr' ? 'fr-CA' : 'en-CA');
  return `${v} ${area.unit}`;
}

export function fmtDate(iso, locale) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(
    locale === 'fr' ? 'fr-CA' : 'en-CA',
    { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' },
  );
}

/** Build the per-page template context. */
export function makeCtx({ locale, site, strings, listings, agents, hoods, rates }) {
  const T = (key) => {
    const entry = strings[key];
    if (!entry) throw new Error(`strings.json: missing key "${key}"`);
    return entry[locale];
  };
  return { locale, site, strings, listings, agents, hoods, rates, T };
}
