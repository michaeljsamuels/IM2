import { esc } from './helpers.mjs';

/**
 * Mortgage calculator, pre-filled with the listing's price. All arithmetic
 * runs client-side (src/main.ts); the rate default is baked in at build time
 * from content/rates.json.
 */
export function mortgageCalculator(ctx, listing) {
  const { locale, T, rates } = ctx;
  const price = listing.price;

  return `
<div class="calc" data-calc
     data-price="${price}"
     data-rate="${rates.mortgage5yr}"
     data-min-down-label="${esc(T('calc.minDown'))}"
     data-insurance-note="${esc(T('calc.insuranceNote'))}">
  <h4>${esc(T('calc.heading'))}</h4>
  <div class="calc__fields">
    <label>
      <span>${esc(T('calc.price'))}</span>
      <input type="number" data-calc-price value="${price}" min="0" step="1000" inputmode="numeric" />
    </label>
    <label>
      <span>${esc(T('calc.down'))}</span>
      <span class="calc__pair">
        <input type="number" data-calc-down-pct value="20" min="0" max="100" step="0.5" inputmode="decimal" />
        <span class="calc__unit">%</span>
        <input type="number" data-calc-down-amt min="0" step="1000" inputmode="numeric" />
      </span>
    </label>
    <label>
      <span>${esc(T('calc.rate'))}</span>
      <input type="number" data-calc-rate value="${rates.mortgage5yr}" min="0" max="25" step="0.01" inputmode="decimal" />
    </label>
    <label>
      <span>${esc(T('calc.amort'))}</span>
      <select data-calc-amort>
        ${[15, 20, 25, 30]
          .map((y) => `<option value="${y}"${y === 25 ? ' selected' : ''}>${y} ${esc(T('calc.years'))}</option>`)
          .join('')}
      </select>
    </label>
    <label>
      <span>${esc(T('calc.frequency'))}</span>
      <select data-calc-freq>
        <option value="monthly">${esc(T('calc.monthly'))}</option>
        <option value="biweekly">${esc(T('calc.biweekly'))}</option>
      </select>
    </label>
  </div>

  <div class="calc__result">
    <p class="calc__payment"><span data-calc-payment>—</span></p>
    <p class="calc__payment-label">${esc(T('calc.result'))}</p>
    <dl class="calc__breakdown">
      <div><dt>${esc(T('calc.loan'))}</dt><dd data-calc-loan>—</dd></div>
      <div><dt>${esc(T('calc.totalInterest'))}</dt><dd data-calc-interest>—</dd></div>
    </dl>
  </div>

  <p class="calc__warn" data-calc-warn hidden></p>
  <p class="calc__note">
    ${esc(T('calc.rateNote'))} ${esc(rates.asOf)}
    (<a href="${rates.sourceUrl}" rel="noopener" target="_blank">${esc(rates.source)}</a>).
  </p>
  <p class="calc__note calc__note--fine">${esc(T('calc.disclaimer'))}</p>
</div>`;
}
