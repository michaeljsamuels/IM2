import { ROUTES, esc, fmtPrice, fmtMoney, fmtArea, fmtDate } from './helpers.mjs';
import { icons } from './icons.mjs';
import { listingCard } from './cards.mjs';
import { mortgageCalculator } from './calculator.mjs';

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
        ${
          agent
            ? `
        <div class="broker-card">
          <h4>${esc(T('detail.agent.heading'))}</h4>
          <img src="${agent.photo}" alt="${esc(agent.name)}" loading="lazy" />
          <p class="broker-card__name">${esc(agent.name)}</p>
          <p class="broker-card__title">${esc(agent.title[locale])}</p>
          <p class="broker-card__contact">
            <a href="tel:+1${agent.phone.replaceAll('-', '')}">${icons.phone} ${esc(agent.phone)}</a>
            <a href="mailto:${esc(agent.email)}">${icons.mail} ${esc(agent.email)}</a>
          </p>
        </div>`
            : ''
        }
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
