import { ROUTES, esc } from './helpers.mjs';
import { icons } from './icons.mjs';
import { listingCard, agentCard } from './cards.mjs';

export function homePage(ctx) {
  const { locale, site, strings, T, listings, agents, hoods } = ctx;

  const featured = listings.filter((l) => l.featured && l.status === 'for-sale').slice(0, 6);
  const featuredAgents = agents.filter((a) => a.featured).slice(0, 4);

  return `
<section class="hero">
  <div class="hero__bg"><img src="/images/hero.jpg" alt="" /></div>
  <div class="hero__content">
    <h1>${esc(site.brand).replace(/i/gi, (c) => `<span class="accent-i">${c}</span>`)}</h1>
    <p class="eyebrow">${esc(T('hero.eyebrow'))}</p>
    <a class="hero__arrow" href="#about" aria-label="${esc(T('hero.cta'))}">${icons.arrowDown}</a>
  </div>
</section>

<section class="band band--about" id="about">
  <div class="band__inner band__inner--narrow">
    <h2>${esc(T('about.heading'))}</h2>
    <p class="serif-accent">${esc(T('about.serif'))}</p>
    <p>${esc(T('about.body1'))}</p>
    <a class="btn btn--outline" href="${ROUTES.team[locale]}">${esc(T('about.cta'))}</a>
  </div>
</section>

<section class="band band--alt" id="featured">
  <div class="band__inner">
    <h2>${esc(T('featured.heading'))}</h2>
    <p class="serif-accent">${esc(T('featured.serif'))}</p>
    <div class="card-grid">
      ${featured.map((l) => listingCard(ctx, l)).join('\n')}
    </div>
    <div class="band__cta"><a class="btn" href="${ROUTES.sale[locale]}">${esc(T('featured.cta'))}</a></div>
  </div>
</section>

<section class="band" id="team">
  <div class="band__inner">
    <h2>${esc(strings['team.title'][locale])}</h2>
    <p class="serif-accent">${esc(strings['team.title'][locale === 'en' ? 'fr' : 'en'])}</p>
    <div class="agent-grid">
      ${featuredAgents.map((a) => agentCard(ctx, a)).join('\n')}
    </div>
    <div class="band__cta"><a class="btn btn--outline" href="${ROUTES.team[locale]}">${esc(T('team.cta'))}</a></div>
  </div>
</section>

<section class="band band--dark quicklinks">
  <div class="band__inner">
    <a href="${ROUTES.sale[locale]}">${esc(T('quicklinks.sale'))}</a>
    <a href="${ROUTES.rent[locale]}">${esc(T('quicklinks.rent'))}</a>
    <a href="${ROUTES.team[locale]}">${esc(T('quicklinks.team'))}</a>
    <a href="${ROUTES.contact[locale]}">${esc(T('quicklinks.contact'))}</a>
  </div>
</section>

<section class="band band--contact" id="contact-band">
  <div class="band__inner">
    <h2>${esc(T('contactband.heading'))}</h2>
    <p class="serif-accent serif-accent--light">${esc(T('contactband.serif'))}</p>
    <a class="btn" href="${ROUTES.contact[locale]}">${esc(T('nav.contact'))}</a>
  </div>
</section>`;
}
