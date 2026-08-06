import { esc, fmtPrice, fmtArea, listingUrl } from './helpers.mjs';
import { icons } from './icons.mjs';

/** Cream listing card used on the homepage, index pages and similar-strip. */
export function listingCard(ctx, listing) {
  const { locale, strings, T, hoods } = ctx;
  const hood = hoods.find((h) => h.id === listing.neighbourhood);
  const statusClass = listing.status === 'sold' || listing.status === 'rented' ? 'chip--sold' : '';
  const place = hood ? hood.name[locale] : listing.borough || listing.city;

  const facts = [
    listing.beds != null ? `<li title="${esc(T('card.beds'))}">${icons.bed}<span>${listing.beds}</span></li>` : '',
    listing.baths != null ? `<li title="${esc(T('card.baths'))}">${icons.bath}<span>${listing.baths}${listing.powderRooms ? ` + ${listing.powderRooms}` : ''}</span></li>` : '',
    listing.livingArea ? `<li title="${esc(T('card.area'))}">${icons.area}<span>${esc(fmtArea(listing.livingArea, locale))}</span></li>` : '',
  ].filter(Boolean);

  return `
  <a class="property-card" href="${listingUrl(listing, locale)}"
     data-price="${listing.price}" data-date="${listing.listedDate ?? ''}" data-hood="${listing.neighbourhood ?? ''}">
    <div class="property-card__media">
      <img src="${listing.photos[0]}" alt="${esc(listing.address)}" loading="lazy" />
      <span class="chip">${esc(listing.type[locale])}</span>
      <span class="chip chip--status ${statusClass}">${esc(T(`status.${listing.status}`))}</span>
    </div>
    <div class="property-card__body">
      <p class="property-card__price">${esc(fmtPrice(listing, locale, strings))}</p>
      <h3 class="property-card__address">${esc(listing.address)}<span> — ${esc(place)}</span></h3>
      ${facts.length ? `<ul class="property-card__facts">${facts.join('')}</ul>` : ''}
    </div>
  </a>`;
}

/** 3:4 portrait card with name overlaid, used for the broker grids. */
export function agentCard(ctx, agent) {
  const { locale } = ctx;
  return `
  <div class="agent-card">
    <img src="${agent.photo}" alt="${esc(agent.name)}" loading="lazy" />
    <div class="agent-card__overlay">
      <h4>${esc(agent.name)}</h4>
      <p>${esc(agent.title[locale])}</p>
    </div>
  </div>`;
}
