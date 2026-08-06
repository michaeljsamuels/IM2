import { ROUTES, esc } from './helpers.mjs';
import { icons } from './icons.mjs';

/**
 * Full HTML page shell: <head>, fixed header, fullscreen menu, footer.
 * `path`/`altPath` are the page's own URL in each language (for the
 * language switcher and hreflang alternates).
 */
export function layout(ctx, { title, description, path, altPath, body, hasHero = false }) {
  const { locale, site, T } = ctx;
  const other = locale === 'en' ? 'fr' : 'en';

  const navLinks = [
    [ROUTES.sale[locale], T('nav.sale')],
    [ROUTES.rent[locale], T('nav.rent')],
    [ROUTES.team[locale], T('nav.team')],
    [ROUTES.contact[locale], T('nav.contact')],
  ];

  const langSwitch = `
    <div class="lang-switch">
      <a href="${path}" class="is-active" aria-current="true">${locale.toUpperCase()}</a><span>|</span><a href="${altPath}">${other.toUpperCase()}</a>
    </div>`;

  return `<!doctype html>
<html lang="${locale === 'fr' ? 'fr-CA' : 'en-CA'}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}" />
  <link rel="alternate" hreflang="${locale === 'fr' ? 'fr-CA' : 'en-CA'}" href="${site.domain}${path}" />
  <link rel="alternate" hreflang="${other === 'fr' ? 'fr-CA' : 'en-CA'}" href="${site.domain}${altPath}" />
  <link rel="icon" href="/images/favicon.svg" type="image/svg+xml" />
  <script type="module" src="/src/main.ts"></script>
</head>
<body class="${hasHero ? 'has-hero' : ''}">

<header class="site-header" data-header>
  <div class="site-header__inner">
    <a class="site-header__logo" href="${ROUTES.home[locale]}">
      <img class="logo-img" src="/images/im-logo.png" alt="${esc(site.brand)} — ${esc(site.slogan[locale])}" />
    </a>
    <nav class="site-header__nav" aria-label="Main">
      ${navLinks.map(([href, label]) => `<a href="${href}">${esc(label)}</a>`).join('\n      ')}
    </nav>
    <div class="site-header__right">
      ${langSwitch}
      <button class="menu-toggle" data-menu-open aria-label="${esc(T('nav.menu'))}">
        <span></span><span></span><span></span>
      </button>
    </div>
  </div>
</header>

<div class="fullscreen-menu" data-menu hidden>
  <button class="fullscreen-menu__close" data-menu-close aria-label="${esc(T('nav.close'))}">${icons.close}</button>
  <nav aria-label="Fullscreen">
    <a href="${ROUTES.home[locale]}">${esc(T('nav.about'))}</a>
    ${navLinks.map(([href, label]) => `<a href="${href}">${esc(label)}</a>`).join('\n    ')}
  </nav>
  <div class="fullscreen-menu__meta">
    ${langSwitch}
    <a href="tel:+1${site.phone.replaceAll('-', '')}">${esc(site.phone)}</a>
  </div>
</div>

<main>
${body}
</main>

<footer class="site-footer">
  <div class="site-footer__inner">
    <div class="site-footer__col">
      <span class="logo-word">${esc(site.brand)}</span>
      <nav aria-label="Footer">
        ${navLinks.map(([href, label]) => `<a href="${href}">${esc(label)}</a>`).join('\n        ')}
      </nav>
    </div>
    <div class="site-footer__col">
      <h4>${esc(T('contact.office'))}</h4>
      <p>${esc(site.office.address)}<br/>${esc(site.office.city)}, ${esc(site.office.province)} ${esc(site.office.postalCode)}</p>
    </div>
    <div class="site-footer__col">
      <h4>${esc(T('footer.getInTouch'))}</h4>
      <p>
        <a href="tel:+1${site.phone.replaceAll('-', '')}">${esc(site.phone)}</a><br/>
        <a href="mailto:${esc(site.email)}">${esc(site.email)}</a>
      </p>
      <div class="social-row">
        <a href="${site.social.facebook}" aria-label="Facebook" rel="noopener" target="_blank">${icons.facebook}</a>
        <a href="${site.social.instagram}" aria-label="Instagram" rel="noopener" target="_blank">${icons.instagram}</a>
        <a href="${site.social.linkedin}" aria-label="LinkedIn" rel="noopener" target="_blank">${icons.linkedin}</a>
      </div>
    </div>
  </div>
  <div class="site-footer__legal">
    <p>${esc(site.oaciq.notice[locale])}</p>
    <p>© 2026 ${esc(site.legalName)}. ${esc(T('footer.rights'))}</p>
  </div>
</footer>

</body>
</html>`;
}
