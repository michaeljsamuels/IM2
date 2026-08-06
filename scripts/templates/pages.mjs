import { esc } from './helpers.mjs';
import { icons } from './icons.mjs';
import { agentCard } from './cards.mjs';

export function teamPage(ctx) {
  const { T, agents } = ctx;
  return `
<section class="page-head">
  <div class="band__inner">
    <h1>${esc(T('team.title'))}</h1>
    <p class="serif-accent">${esc(T('team.serif'))}</p>
  </div>
</section>
<section class="band">
  <div class="band__inner">
    <div class="agent-grid agent-grid--full">
      ${agents.map((a) => agentCard(ctx, a)).join('\n')}
    </div>
  </div>
</section>`;
}

export function hoodsPage(ctx) {
  const { locale, T, hoods } = ctx;
  return `
<section class="page-head">
  <div class="band__inner">
    <h1>${esc(T('hoods.title'))}</h1>
    <p class="serif-accent">${esc(T('hoods.serif'))}</p>
  </div>
</section>
<section class="band">
  <div class="band__inner hood-rows">
    ${hoods
      .map(
        (h, i) => `
    <div class="hood-row ${i % 2 ? 'hood-row--flip' : ''}" id="${h.id}">
      <img src="${h.image}" alt="${esc(h.name[locale])}" loading="lazy" />
      <div>
        <h2>${esc(h.name[locale])}</h2>
        <p>${esc(h.blurb[locale])}</p>
      </div>
    </div>`,
      )
      .join('\n')}
  </div>
</section>`;
}

export function contactPage(ctx) {
  const { site, T } = ctx;
  return `
<section class="page-head">
  <div class="band__inner">
    <h1>${esc(T('contact.title'))}</h1>
    <p class="serif-accent">${esc(T('contactband.serif'))}</p>
  </div>
</section>
<section class="band">
  <div class="band__inner split">
    <div>
      <h4>${esc(T('contact.office'))}</h4>
      <p>${icons.pin} ${esc(site.office.address)}<br/>${esc(site.office.city)}, ${esc(site.office.province)} ${esc(site.office.postalCode)}</p>
      <p><a href="tel:+1${site.phone.replaceAll('-', '')}">${icons.phone} ${esc(site.phone)}</a></p>
      <p><a href="mailto:${esc(site.email)}">${icons.mail} ${esc(site.email)}</a></p>
    </div>
    <form class="inquiry-form" data-inquiry>
      <input type="text" name="name" placeholder="${esc(T('form.name'))}" required />
      <input type="email" name="email" placeholder="${esc(T('form.email'))}" required />
      <input type="tel" name="phone" placeholder="${esc(T('form.phone'))}" />
      <select name="role">
        <option value="">${esc(T('form.iam'))}</option>
        <option>${esc(T('form.buyer'))}</option>
        <option>${esc(T('form.seller'))}</option>
        <option>${esc(T('form.tenant'))}</option>
        <option>${esc(T('form.other'))}</option>
      </select>
      <textarea name="message" rows="5" placeholder="${esc(T('form.message'))}"></textarea>
      <button class="btn" type="submit">${esc(T('form.send'))}</button>
      <p class="form-note">${esc(T('form.disabled'))}</p>
    </form>
  </div>
</section>`;
}
