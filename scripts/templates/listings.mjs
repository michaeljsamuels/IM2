import { esc } from './helpers.mjs';
import { listingCard } from './cards.mjs';

/**
 * Sold / closed transactions. Centris distribution does not carry final sale
 * prices (ClosePrice is null), so we show the last list price and say so.
 */
export function soldPage(ctx) {
  const { T, listings } = ctx;
  const sold = listings
    .filter((l) => l.status === 'sold' || l.status === 'rented')
    .sort((a, b) => (b.listedDate ?? '').localeCompare(a.listedDate ?? ''));

  return `
<section class="page-head">
  <div class="band__inner">
    <h1>${esc(T('sold.title'))}</h1>
    <p class="serif-accent">${esc(T('sold.serif'))}</p>
  </div>
</section>

<section class="band">
  <div class="band__inner">
    ${
      sold.length
        ? `<div class="card-grid">
      ${sold.map((l) => listingCard(ctx, l)).join('\n')}
    </div>
    <p class="calc__note">${esc(T('sold.priceNote'))}</p>`
        : `<p class="empty-note">${esc(T('sold.empty'))}</p>`
    }
  </div>
</section>`;
}

/**
 * Listings index page (for-sale or for-rent). Filtering/sorting happens
 * client-side in src/main.ts via the data-* attributes on each card.
 */
/**
 * Listings index. `filter` narrows the set (status and/or asset classes);
 * `serif` overrides the sub-heading.
 *
 * Asset-type tabs are generated only for classes that actually have
 * inventory — an empty "Retail" tab is worse than no tab.
 */
export function listingsPage(ctx, { status, title, serif, assetTypes, showAssetTabs = true }) {
  const { locale, T, listings, hoods } = ctx;
  const matches = listings.filter(
    (l) => (!status || l.status === status) && (!assetTypes || assetTypes.includes(l.assetType)),
  );
  const hoodsInUse = hoods.filter((h) => matches.some((l) => l.neighbourhood === h.id));

  // Only offer tabs for asset classes present in this result set.
  const ORDER = ['residential', 'multiplex', 'commercial', 'industrial', 'land'];
  const present = ORDER.filter((a) => matches.some((l) => l.assetType === a));
  const tabs =
    showAssetTabs && present.length > 1
      ? `
    <div class="asset-tabs" data-asset-tabs aria-label="${esc(T('asset.filter'))}">
      <button class="is-active" data-asset="">${esc(T('asset.all'))} <span>${matches.length}</span></button>
      ${present
        .map(
          (a) =>
            `<button data-asset="${a}">${esc(T(`asset.${a}`))} <span>${matches.filter((l) => l.assetType === a).length}</span></button>`,
        )
        .join('\n      ')}
    </div>`
      : '';

  return `
<section class="page-head">
  <div class="band__inner">
    <h1>${esc(title)}</h1>
    <p class="serif-accent">${serif ? esc(serif) : `${matches.length} ${esc(T('listings.count'))}`}</p>
    ${tabs}
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
