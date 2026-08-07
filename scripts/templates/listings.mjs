import { esc } from './helpers.mjs';
import { listingCard } from './cards.mjs';

/**
 * Listings index page (for-sale or for-rent). Filtering/sorting happens
 * client-side in src/main.ts via the data-* attributes on each card.
 */
export function listingsPage(ctx, { status, title }) {
  const { locale, T, listings, hoods } = ctx;
  const matches = listings.filter((l) => l.status === status);
  const hoodsInUse = hoods.filter((h) => matches.some((l) => l.neighbourhood === h.id));

  return `
<section class="page-head">
  <div class="band__inner">
    <h1>${esc(title)}</h1>
    <p class="serif-accent">${matches.length} ${esc(T('listings.count'))}</p>
  </div>
</section>

<section class="band">
  <div class="band__inner">
    <div class="filter-bar" data-filter-bar>
      <label>
        <span>${esc(T('listings.filter.neighbourhood'))}</span>
        <select data-filter-hood>
          <option value="">${esc(T('listings.filter.all'))}</option>
          ${hoodsInUse.map((h) => `<option value="${h.id}">${esc(h.name[locale])}</option>`).join('\n          ')}
        </select>
      </label>
      <label>
        <span>${esc(T('listings.sort'))}</span>
        <select data-sort>
          <option value="recent">${esc(T('listings.sort.recent'))}</option>
          <option value="price-desc">${esc(T('listings.sort.priceDesc'))}</option>
          <option value="price-asc">${esc(T('listings.sort.priceAsc'))}</option>
        </select>
      </label>
      <div class="view-toggle" data-view-toggle>
        <button class="is-active" data-view="grid">${esc(T('listings.view.grid'))}</button>
        <button data-view="map">${esc(T('listings.view.map'))}</button>
      </div>
    </div>

    <div class="listings-map" data-listings-map hidden></div>
    <div class="card-grid" data-listing-grid>
      ${matches.map((l) => listingCard(ctx, l)).join('\n')}
    </div>
    <p class="empty-note" data-empty-note hidden>${esc(T('listings.empty'))}</p>
  </div>
</section>`;
}
