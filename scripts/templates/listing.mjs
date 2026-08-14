import { ROUTES, esc, fmtPrice, fmtMoney, fmtArea, fmtDate } from './helpers.mjs';
import { icons } from './icons.mjs';
import { listingCard } from './cards.mjs';
import { mortgageCalculator } from './calculator.mjs';

/**
 * Revenue-property panel for multiplex / commercial listings.
 *
 * Shows gross yield, NOT a cap rate: Centris supplies gross scheduled income
 * but no net operating income, and expense data is partial. The distinction is
 * stated on the page so nobody mistakes one for the other.
 */
function revenueBlock(ctx, listing) {
  const { locale, T } = ctx;
  const r = listing.revenue;
  if (!r || (!r.units && !r.grossIncome)) return '';

  const money = (n) =>
    locale === 'fr' ? `${n.toLocaleString('fr-CA')} $` : `$${n.toLocaleString('en-CA')}`;

  const stats = [
    r.units ? [T('rev.units'), String(r.units)] : null,
    r.unitsLeased != null && r.unitsVacant != null
      ? [T('rev.occupancy'), `${r.unitsLeased} / ${r.unitsVacant}`]
      : null,
    r.grossIncome
      ? [`${T('rev.gross')}${r.grossIncomeYear ? ` (${r.grossIncomeYear})` : ''}`, money(r.grossIncome)]
      : null,
    r.grossYieldPct ? [T('rev.yield'), `${r.grossYieldPct}%`] : null,
    listing.zoning?.[locale] ? [T('rev.zoning'), listing.zoning[locale]] : null,
  ].filter(Boolean);

  const mix = r.unitMix ?? [];

  return `
<div class="revenue">
  <h4>${esc(T('rev.heading'))}</h4>
  <dl class="revenue__stats">
    ${stats.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('\n    ')}
  </dl>
  ${
    mix.length
      ? `<div class="revenue__mix">
    <h5>${esc(T('rev.unitMix'))}</h5>
    <ul>
      ${mix
        .map(
          (u) =>
            `<li><strong>${esc(u.type ?? '—')}</strong>${
              u.beds != null ? `<span>${u.beds} ${esc(T('card.beds').toLowerCase())}</span>` : ''
            }</li>`,
        )
        .join('\n      ')}
    </ul>
  </div>`
      : ''
  }
  ${r.grossYieldPct ? `<p class="revenue__note">${esc(T('rev.yieldNote'))}</p>` : ''}
</div>`;
}

/**
 * Broker card(s). Listings are frequently co-listed (40% of our inventory),
 * so every broker on the listing is shown. Team members link to their profile
 * and show full contact details; co-listing brokers from other agencies are
 * credited by name only.
 */
function brokerCards(ctx, listing) {
  const { locale, T, agents } = ctx;
  const brokers = listing.brokers?.length
    ? listing.brokers
    : listing.agentId
      ? [{ id: listing.agentId, name: null, external: false }]
      : [];
  if (!brokers.length) return '';

  const heading = brokers.length > 1 ? T('detail.agents.heading') : T('detail.agent.heading');

  const cards = brokers
    .map((b) => {
      const a = b.id ? agents.find((x) => x.id === b.id) : null;
      if (!a) {
        return b.name
          ? `<div class="broker-card broker-card--external">
          <p class="broker-card__name">${esc(b.name)}</p>
          <p class="broker-card__title">${esc(T('detail.agent.coListing'))}</p>
        </div>`
          : '';
      }
      return `<div class="broker-card">
          <a href="${ROUTES.team[locale]}${a.id}/">
            <img src="${a.photo}" alt="${esc(a.name)}" loading="lazy" />
            <p class="broker-card__name">${esc(a.name)}</p>
          </a>
          <p class="broker-card__title">${esc(a.title[locale])}</p>
          <p class="broker-card__contact">
            <a href="tel:+1${a.phone.replaceAll('-', '')}">${icons.phone} ${esc(a.phone)}</a>
            <a href="mailto:${esc(a.email)}">${icons.mail} ${esc(a.email)}</a>
          </p>
        </div>`;
    })
    .filter(Boolean);

  return `
        <div class="broker-cards">
          <h4>${esc(heading)}</h4>
          ${cards.join('\n          ')}
        </div>`;
}

/** Property detail page: 1+4 gallery, key facts, tabs, broker card, similar strip. */
export function listingPage(ctx, listing) {
  const { locale, strings, T, listings, agents, hoods } = ctx;
  const agent = agents.find((a) => a.id === listing.agentId);
  const hood = hoods.find((h) => h.id === listing.neighbourhood);
  const photos = listing.photos;
  const gridPhotos = photos.slice(0, 5);
  const similar = listings
    .filter((l) => l.id !== listing.id && l.status === listing.status)
    .slice(0, 3);
  const backRoute = listing.status === 'for-rent' ? ROUTES.rent[locale] : ROUTES.sale[locale];

  const factItems = [
    [icons.calendar, T('detail.listed'), listing.listedDate ? fmtDate(listing.listedDate, locale) : null],
    [icons.bed, T('card.beds'), listing.beds != null ? String(listing.beds) : null],
    [icons.bath, T('card.baths'), listing.baths != null ? `${listing.baths}${listing.powderRooms ? ` + ${listing.powderRooms}` : ''}` : null],
    [icons.car, T('detail.parking'), listing.parking?.[locale]],
    [icons.building, T('detail.yearBuilt'), listing.yearBuilt ? String(listing.yearBuilt) : null],
    [icons.area, T('card.area'), fmtArea(listing.livingArea, locale)],
  ].filter(([, , v]) => v);

  const detailRows = [
    [T('detail.condoFees'), listing.condoFees != null ? `${fmtMoney(listing.condoFees, locale)}${T('card.perMonth')}` : null],
    [T('detail.taxMunicipal'), listing.taxes ? fmtMoney(listing.taxes.municipal, locale) : null],
    [T('detail.taxSchool'), listing.taxes ? fmtMoney(listing.taxes.school, locale) : null],
    [T('detail.inclusions'), listing.inclusions?.[locale]],
    [T('detail.exclusions'), listing.exclusions?.[locale]],
  ].filter(([, v]) => v);

  return `
<section class="detail">
  <div class="band__inner">
    <p class="breadcrumb"><a href="${backRoute}">← ${esc(T('detail.back'))}</a></p>

    <div class="photo-grid ${gridPhotos.length < 3 ? 'photo-grid--single' : ''}" data-gallery>
      <button class="photo-grid__main" data-photo="0"><img src="${gridPhotos[0]}" alt="${esc(listing.address)}" /></button>
      <div class="photo-grid__thumbs">
        ${gridPhotos
          .slice(1)
          .map(
            (p, i) => `
        <button data-photo="${i + 1}"><img src="${p}" alt="" loading="lazy" />${
          i === gridPhotos.length - 2
            ? `<span class="photo-grid__count">${icons.camera} ${photos.length} ${esc(T('detail.photos'))}</span>`
            : ''
        }</button>`,
          )
          .join('\n')}
      </div>
      ${photos.map((p) => `<template data-full-photo>${p}</template>`).join('\n      ')}
    </div>

    <div class="detail-head">
      <div>
        <h1>${esc(listing.address)}</h1>
        <p class="detail-head__loc">${icons.pin} ${esc(listing.city)}${hood ? ` — ${esc(hood.name[locale])}` : listing.borough ? ` — ${esc(listing.borough)}` : ''}, QC ${esc(listing.postalCode)}</p>
      </div>
      <div class="detail-head__price">
        <p>${esc(fmtPrice(listing, locale, strings))}</p>
        ${listing.centrisId ? `<span>${esc(T('detail.mls'))} ${esc(listing.centrisId)}</span>` : ''}
      </div>
    </div>

    <div class="detail-cols">
      <div class="detail-main">
        <ul class="fact-strip">
          ${factItems.map(([icon, label, value]) => `<li>${icon}<span class="fact-strip__value">${esc(value)}</span><span class="fact-strip__label">${esc(label)}</span></li>`).join('\n          ')}
        </ul>

        <p class="detail-desc">${esc(listing.description[locale])}</p>

        ${revenueBlock(ctx, listing)}

        ${
          listing.coords
            ? `<div class="listing-map"
             data-map
             data-lat="${listing.coords.lat}"
             data-lng="${listing.coords.lng}"
             data-label="${esc(listing.address)}"
             role="img"
             aria-label="${esc(T('detail.map'))} — ${esc(listing.address)}"></div>`
            : ''
        }

        <div class="tabs" data-tabs>
          <div class="tabs__bar" role="tablist">
            <button class="is-active" data-tab="details">${esc(T('detail.tab.details'))}</button>
            ${listing.features?.[locale]?.length ? `<button data-tab="features">${esc(T('detail.tab.features'))}</button>` : ''}
            ${listing.rooms?.length ? `<button data-tab="rooms">${esc(T('detail.tab.rooms'))}</button>` : ''}
          </div>
          <div class="tabs__panel is-active" data-panel="details">
            <table class="detail-table">
              ${detailRows.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('\n              ')}
            </table>
          </div>
          <div class="tabs__panel" data-panel="features">
            <ul class="feature-list">
              ${(listing.features?.[locale] ?? []).map((f) => `<li>${esc(f)}</li>`).join('\n              ')}
            </ul>
          </div>
          ${
            listing.rooms?.length
              ? `<div class="tabs__panel" data-panel="rooms">
            <table class="detail-table">
              <tr><th>${esc(T('detail.level'))}</th><th>${esc(T('detail.room'))}</th><th>${esc(T('detail.dimensions'))}</th></tr>
              ${listing.rooms.map((r) => `<tr><td>${esc(r.level[locale])}</td><td>${esc(r.name[locale])}</td><td>${esc(r.dims)}</td></tr>`).join('\n              ')}
            </table>
          </div>`
              : ''
          }
        </div>

        ${listing.status === 'for-sale' ? mortgageCalculator(ctx, listing) : ''}
      </div>

      <aside class="detail-side">
        ${brokerCards(ctx, listing)}
        <form class="inquiry-form" data-inquiry>
          <h4>${esc(T('detail.inquire'))}</h4>
          <input type="text" name="name" placeholder="${esc(T('form.name'))}" required />
          <input type="email" name="email" placeholder="${esc(T('form.email'))}" required />
          <input type="tel" name="phone" placeholder="${esc(T('form.phone'))}" />
          <textarea name="message" rows="4" placeholder="${esc(T('form.message'))}"></textarea>
          <button class="btn" type="submit">${esc(T('form.send'))}</button>
          <p class="form-note">${esc(T('form.disabled'))}</p>
        </form>
      </aside>
    </div>

    ${
      similar.length
        ? `
    <div class="similar">
      <h2>${esc(T('detail.similar'))}</h2>
      <div class="card-grid">
        ${similar.map((l) => listingCard(ctx, l)).join('\n')}
      </div>
    </div>`
        : ''
    }
  </div>
</section>

<div class="lightbox" data-lightbox hidden>
  <button class="lightbox__close" data-lightbox-close aria-label="Close">${icons.close}</button>
  <button class="lightbox__nav lightbox__nav--prev" data-lightbox-prev aria-label="Previous">‹</button>
  <img data-lightbox-img alt="" />
  <button class="lightbox__nav lightbox__nav--next" data-lightbox-next aria-label="Next">›</button>
  <p class="lightbox__counter" data-lightbox-counter></p>
</div>`;
}
