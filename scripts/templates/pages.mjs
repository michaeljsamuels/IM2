import { ROUTES, esc } from './helpers.mjs';
import { icons } from './icons.mjs';
import { agentCard, listingCard } from './cards.mjs';

export function teamPage(ctx) {
  const { locale, strings, agents } = ctx;
  return `
<section class="page-head">
  <div class="band__inner">
    <h1>${esc(strings['team.title'][locale])}</h1>
    <p class="serif-accent">${esc(strings['team.title'][locale === 'en' ? 'fr' : 'en'])}</p>
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

/** Broker profile: photo, contact, bio, inquiry form, active listings. */
export function agentPage(ctx, agent) {
  const { locale, T, listings } = ctx;
  const mine = listings.filter((l) => l.agentId === agent.id);
  const bio = agent.bio?.[locale]?.trim();
  const bioParagraphs = bio
    ? bio.split(/\n+/).map((p) => `<p>${esc(p)}</p>`).join('\n')
    : '';

  return `
<section class="band agent-profile-band">
  <div class="band__inner">
    <p class="breadcrumb"><a href="${ROUTES.team[locale]}">← ${esc(T('nav.team'))}</a></p>
    <div class="agent-profile">
      <div class="agent-profile__media">
        <img src="${agent.photo}" alt="${esc(agent.name)}" />
      </div>
      <div class="agent-profile__body">
        <h1>${esc(agent.name)}</h1>
        <p class="agent-profile__title">${esc(agent.title[locale])}</p>
        <p class="agent-profile__contact">
          <a href="tel:+1${agent.phone.replaceAll('-', '')}">${icons.phone} ${esc(agent.phone)}</a>
          <a href="mailto:${esc(agent.email)}">${icons.mail} ${esc(agent.email)}</a>
          ${agent.social?.facebook ? `<a href="${agent.social.facebook}" rel="noopener" target="_blank">${icons.facebook} Facebook</a>` : ''}
          ${agent.social?.linkedin ? `<a href="${agent.social.linkedin}" rel="noopener" target="_blank">${icons.linkedin} LinkedIn</a>` : ''}
        </p>
        ${bioParagraphs}
        <form class="inquiry-form" data-inquiry>
          <h4>${esc(T('footer.getInTouch'))}</h4>
          <input type="text" name="name" placeholder="${esc(T('form.name'))}" required />
          <input type="email" name="email" placeholder="${esc(T('form.email'))}" required />
          <input type="tel" name="phone" placeholder="${esc(T('form.phone'))}" />
          <textarea name="message" rows="4" placeholder="${esc(T('form.message'))}"></textarea>
          <input type="hidden" name="agent_email" value="${esc(agent.email)}" />
          <button class="btn" type="submit">${esc(T('form.send'))}</button>
          <p class="form-note">${esc(T('form.disabled'))}</p>
        </form>
      </div>
    </div>

    ${
      mine.length
        ? `
    <div class="agent-listings">
      <h2>${esc(T('agent.listings'))}</h2>
      <div class="card-grid">
        ${mine.map((l) => listingCard(ctx, l)).join('\n')}
      </div>
    </div>`
        : ''
    }
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
