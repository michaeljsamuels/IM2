/**
 * Maps replicated Centris (RESO) records into the site's content schema.
 *
 * PURE: reads content/centris/*.json and writes content/listings.json.
 * No network access — so mapping can be iterated and tested without
 * re-pulling from the API, and a mapping bug can never corrupt raw data.
 *
 * PRIVACY: fields are whitelisted explicitly below. Broker Loading carries
 * contracts, owner details and compensation data; nothing reaches the public
 * site unless it is named here.
 *
 * Usage:
 *   node scripts/centris/map-listings.mjs            # → content/listings.json
 *   node scripts/centris/map-listings.mjs --out=X    # → content/X (for diffing)
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (p, fb = []) => {
  try {
    return JSON.parse(readFileSync(join(root, p), 'utf8'));
  } catch {
    return fb;
  }
};

const properties = read('content/centris/Property.json');
const members = read('content/centris/Member.json');
const lookups = read('content/centris/Lookup.json');
const roster = read('content/agents.json');
const hoods = read('content/neighbourhoods.json');

// ---- translation + lookup helpers -----------------------------------------

/** Pull a translated field value out of a record's Translations expansion. */
function tr(record, field, locale) {
  const t = (record?.Translations ?? []).find((x) => x.Locale === locale);
  const hit = t?.Values?.find((v) => v.FieldName === field);
  return hit?.Value ?? null;
}

/** Bilingual value for a field: Translations if present, else the raw value. */
function bi(record, field) {
  const en = tr(record, field, 'en') ?? record?.[field] ?? null;
  const fr = tr(record, field, 'fr') ?? en;
  return en == null && fr == null ? null : { en, fr };
}

// Lookup index: "LookupName|LookupValue" -> { en, fr } display labels.
const lookupIndex = new Map();
for (const l of lookups) {
  const key = `${l.LookupName}|${l.LookupValue}`;
  const en = tr(l, 'StandardLookupValue', 'en') ?? tr(l, 'LookupValue', 'en') ?? l.LookupValue;
  const fr = tr(l, 'StandardLookupValue', 'fr') ?? tr(l, 'LookupValue', 'fr') ?? en;
  lookupIndex.set(key, { en, fr });
}

/**
 * Resolve a lookup-backed field to display labels. Values arriving from the
 * API are IDENTIFIERS, not display text — Centris is explicit about this.
 */
function labels(fieldName, values) {
  const arr = Array.isArray(values) ? values : values ? [values] : [];
  return arr.map((v) => lookupIndex.get(`${fieldName}|${v}`) ?? { en: v, fr: v });
}

// ---- field helpers ---------------------------------------------------------

const slugifyName = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

// Centris MemberKey -> our roster slug, matched on name.
const memberBySlug = new Map(members.map((m) => [slugifyName(m.MemberFullName), m]));
const agentKeyToSlug = new Map();
for (const a of roster) {
  const m = memberBySlug.get(slugifyName(a.name)) ?? members.find((x) => slugifyName(x.MemberFullName) === a.id);
  if (m) agentKeyToSlug.set(String(m.MemberKey), a.id);
}

const hoodIds = new Set(hoods.map((h) => h.id));
function neighbourhoodId(p) {
  const raw = p.NeighborhoodName ?? '';
  const township = p.Township ?? '';
  const candidates = [
    slugifyName(raw),
    slugifyName(raw.replace(/^Le\s+/i, '')),
    slugifyName(township.replace(/\s*\(.*\)$/, '')),
    slugifyName((township.match(/\(([^)]+)\)/) ?? [])[1] ?? ''),
  ];
  const alias = {
    'old-montreal': 'vieux-montreal',
    'vieux-montreal': 'vieux-montreal',
    'ville-marie': 'centre-ville',
    downtown: 'centre-ville',
    'notre-dame-de-grace': 'ndg',
    'cote-des-neiges-notre-dame-de-grace': 'ndg',
    'le-sud-ouest': 'le-sud-ouest',
    'sud-ouest': 'le-sud-ouest',
    'le-plateau-mont-royal': 'plateau-mont-royal',
    'plateau-mont-royal': 'plateau-mont-royal',
    westmount: 'westmount',
    outremont: 'outremont',
  };
  for (const c of candidates) {
    if (!c) continue;
    if (alias[c] && hoodIds.has(alias[c])) return alias[c];
    if (hoodIds.has(c)) return c;
  }
  return null;
}

/**
 * Asset class, used for the listing-index filter tabs and the commercial
 * section. Derived from RESO PropertyType/PropertySubType plus
 * BuildingCurrentUse. Only classes with inventory are ever shown as tabs.
 */
function assetTypeOf(p) {
  const type = p.PropertyType ?? '';
  const sub = p.PropertySubType ?? '';
  const uses = p.BuildingCurrentUse ?? [];

  if (sub === 'Industrial' || uses.includes('Industrial')) return 'industrial';
  if (/Commercial/i.test(type) || sub === 'Business' || uses.includes('Commercial') || uses.includes('Office'))
    return 'commercial';
  if (type === 'Residential Income' || ['Duplex', 'Triplex', 'Quadruplex', 'Quintuplex'].includes(sub))
    return 'multiplex';
  if (/^Lots?|Land/i.test(sub)) return 'land';
  return 'residential';
}

/** Unit mix for revenue properties, e.g. [{ type: '6 1/2', beds: 4, baths: 2 }]. */
function unitsOf(p) {
  return (p.Units ?? [])
    .slice()
    .sort((a, b) => (a.Order ?? 0) - (b.Order ?? 0))
    .map((u) => ({
      type: u.UnitType ?? null,
      beds: u.UnitBedroomsTotal ?? null,
      baths: u.UnitBathroomsFullTotal ?? null,
      rooms: u.UnitRoomsTotal ?? null,
      use: u.UnitCurrentUse ?? null,
    }))
    .filter((u) => u.type || u.beds != null);
}

const memberByKey = new Map(members.map((m) => [String(m.MemberKey), m]));

/**
 * Listing + co-listing brokers, in order. `id` is our roster slug when the
 * broker is on the team (so the card links to their profile); brokers from
 * other brokerages appear by name only.
 */
function brokersOf(p) {
  const out = [];
  for (const keyField of ['ListAgentKey', 'CoListAgentKey']) {
    const key = p[keyField];
    if (!key) continue;
    const k = String(key);
    if (out.some((b) => b.key === k)) continue; // same broker in both slots
    const slug = agentKeyToSlug.get(k) ?? null;
    const name = memberByKey.get(k)?.MemberFullName ?? null;
    if (!slug && !name) continue;
    out.push({ key: k, id: slug, name, external: !slug });
  }
  return out;
}

function statusOf(p) {
  const isLease = /Lease/i.test(p.PropertyType ?? '');
  const closed = p.StandardStatus === 'Closed' || /sold|rented|leased/i.test(p.MlsStatus ?? '');
  if (closed) return isLease ? 'rented' : 'sold';
  return isLease ? 'for-rent' : 'for-sale';
}

function addressOf(p) {
  const parts = [p.StreetNumberStart, p.StreetShortName ?? p.StreetName].filter(Boolean).join(' ').trim();
  const unit = p.UnitNumber ? `, apt. ${p.UnitNumber}` : '';
  return (parts + unit).trim() || (p.UnparsedAddress ?? '').trim();
}

const postal = (s) =>
  s ? String(s).toUpperCase().replace(/\s+/g, '').replace(/^([A-Z]\d[A-Z])(\d[A-Z]\d)$/, '$1 $2') : '';

function expenseAmount(p, type, subType) {
  const e = (p.Expenses ?? []).find(
    (x) => x.ExpenseType === type && (!subType || x.ExpenseSubType === subType),
  );
  return e?.ExpenseAmount ?? null;
}

function roomsOf(p) {
  return (p.Rooms ?? [])
    .slice()
    .sort((a, b) => (a.Order ?? 0) - (b.Order ?? 0))
    .map((r) => {
      const level = labels('RoomLevel', [r.RoomLevel])[0] ?? { en: r.RoomLevel, fr: r.RoomLevel };
      const type = labels('RoomType', [r.RoomType])[0] ?? { en: r.RoomType, fr: r.RoomType };
      return {
        level: { en: level.en, fr: level.fr },
        name: { en: type.en, fr: type.fr },
        dims: r.RoomDimensions ?? r.RoomDimensionsFeet ?? '',
      };
    })
    .filter((r) => r.name.en);
}

function photosOf(p) {
  return (p.Media ?? [])
    .filter((m) => m.MediaCategory === 'Photo' && m.MediaStatus === 'Active' && m.MediaURL)
    .sort((a, b) => (a.Order ?? 0) - (b.Order ?? 0))
    .map((m) => m.MediaURL);
}

// Lookup-backed descriptive fields we surface as "features".
const FEATURE_FIELDS = [
  'PropertyFeatures', 'LotFeatures', 'InteriorFeatures', 'ExteriorFeatures',
  'ParkingFeatures', 'PoolFeatures', 'ViewYN', 'View', 'Heating', 'Cooling',
  'WaterSource', 'Sewer', 'Utilities', 'StructureType', 'Levels',
  'CommonWalls', 'Basement', 'Appliances', 'Roof', 'ConstructionMaterials',
  'Topography', 'Zoning', 'PetsAllowed',
];

function featuresOf(p) {
  const en = [];
  const fr = [];
  for (const f of FEATURE_FIELDS) {
    const v = p[f];
    if (!v || typeof v === 'boolean') continue;
    for (const lbl of labels(f, v)) {
      if (lbl.en && !en.includes(lbl.en)) {
        en.push(lbl.en);
        fr.push(lbl.fr ?? lbl.en);
      }
    }
  }
  return { en, fr };
}

// ---- the mapping ----------------------------------------------------------

function mapListing(p) {
  const status = statusOf(p);
  const isLease = /Lease/i.test(p.PropertyType ?? '');
  const price = p.ListPrice ?? p.RentPrice ?? null;
  const condoAnnual = expenseAmount(p, 'General', 'Condominium fees');
  const subType = bi(p, 'PropertySubType') ?? { en: p.PropertySubType, fr: p.PropertySubType };
  const subLabel = labels('PropertySubType', [p.PropertySubType])[0];

  return {
    id: Number(p.ListingKey),
    centrisId: String(p.ListingId ?? p.ListingKey),
    status,
    category: /Commercial/i.test(p.PropertyType ?? '') ? 'commercial' : 'residential',
    assetType: assetTypeOf(p),
    featured: false,
    type: {
      en: subLabel?.en ?? subType.en ?? 'Property',
      fr: subLabel?.fr ?? subType.fr ?? subType.en ?? 'Propriété',
    },
    price,
    address: addressOf(p),
    postalCode: postal(p.PostalCode),
    city: (p.Township ?? '').replace(/\s*\(.*\)$/, '').trim() || 'Montréal',
    borough: (p.Township?.match(/\(([^)]+)\)/) ?? [])[1] ?? p.NeighborhoodName ?? '',
    ...(neighbourhoodId(p) ? { neighbourhood: neighbourhoodId(p) } : {}),
    ...(Number.isFinite(p.Latitude) && Number.isFinite(p.Longitude)
      ? { coords: { lat: p.Latitude, lng: p.Longitude } }
      : {}),
    beds: p.BedroomsTotal ?? null,
    baths: p.BathroomsFull ?? null,
    powderRooms: p.BathroomsPartial ?? 0,
    livingArea:
      p.LivingArea != null
        ? {
            value: Math.round(p.LivingArea * 10) / 10,
            unit: /metre|meter|m2|square met/i.test(p.LivingAreaUnits ?? '') ? 'm²' : 'ft²',
          }
        : null,
    yearBuilt: p.YearBuilt ?? null,
    parking:
      p.ParkingTotal
        ? {
            en: `${p.ParkingTotal} space${p.ParkingTotal > 1 ? 's' : ''}`,
            fr: `${p.ParkingTotal} place${p.ParkingTotal > 1 ? 's' : ''}`,
          }
        : null,
    listedDate: (p.OnMarketTimestamp ?? p.StatusChangeTimestamp ?? '').slice(0, 10) || null,
    agentId: agentKeyToSlug.get(String(p.ListAgentKey)) ?? null,
    // 40% of listings are co-listed. Both brokers must appear; co-listing
    // agents from other brokerages are shown by name without a profile link.
    brokers: brokersOf(p),
    description: bi(p, 'PublicRemarks') ?? { en: '', fr: '' },
    features: featuresOf(p),
    rooms: roomsOf(p),
    // Centris reports condo fees annually; the site shows a monthly figure.
    condoFees: condoAnnual != null ? Math.round(condoAnnual / 12) : null,
    taxes:
      expenseAmount(p, 'Tax', 'Municipal') != null || expenseAmount(p, 'Tax', 'School') != null
        ? {
            municipal: expenseAmount(p, 'Tax', 'Municipal'),
            school: expenseAmount(p, 'Tax', 'School'),
          }
        : null,
    inclusions: bi(p, 'Inclusions'),
    exclusions: bi(p, 'Exclusions'),
    zoning: bi(p, 'ZoningDescription'),
    // Revenue-property data. NOTE: Centris carries gross scheduled income but
    // NOT net operating income, and expense data is partial (taxes/condo fees
    // only). We therefore expose GROSS YIELD, explicitly labelled — never a
    // "cap rate", which investors would act on and we cannot stand behind.
    revenue:
      p.GrossScheduledIncomeResidential || p.NumberOfUnitsTotal
        ? {
            units: p.NumberOfUnitsTotal ?? null,
            unitsLeased: p.NumberOfUnitsLeased ?? null,
            unitsVacant: p.NumberOfUnitsVacant ?? null,
            grossIncome: p.GrossScheduledIncomeResidential ?? null,
            grossIncomeYear: (p.GrossScheduledIncomeDate ?? '').slice(0, 4) || null,
            grossYieldPct:
              p.GrossScheduledIncomeResidential && p.ListPrice
                ? Math.round((p.GrossScheduledIncomeResidential / p.ListPrice) * 1000) / 10
                : null,
            unitMix: unitsOf(p),
          }
        : null,
    photos: photosOf(p),
    rental: isLease || undefined,
  };
}

const outArg = process.argv.find((a) => a.startsWith('--out='));
const outFile = outArg ? outArg.split('=')[1] : 'listings.json';

// Only listings Centris flags as internet-displayable reach the public site.
const displayable = properties.filter((p) => p.InternetEntireListingDisplayYN !== false);
const skipped = properties.length - displayable.length;

const listings = displayable.map(mapListing).filter((l) => l.price && l.address && l.photos.length);
const dropped = displayable.length - listings.length;

// Feature the six priciest active sale listings on the homepage.
listings
  .filter((l) => l.status === 'for-sale')
  .sort((a, b) => b.price - a.price)
  .slice(0, 6)
  .forEach((l) => (l.featured = true));

listings.sort((a, b) => b.id - a.id);
writeFileSync(join(root, 'content', outFile), JSON.stringify(listings, null, 2) + '\n');

const by = (s) => listings.filter((l) => l.status === s).length;
console.log(
  `✓ mapped ${listings.length} listings → content/${outFile}\n` +
    `  for-sale ${by('for-sale')}, for-rent ${by('for-rent')}, sold ${by('sold')}, rented ${by('rented')}\n` +
    `  ${listings.filter((l) => l.agentId).length} linked to a roster broker, ` +
    `${listings.reduce((n, l) => n + l.photos.length, 0)} photos` +
    (skipped ? `\n  ${skipped} withheld (InternetEntireListingDisplayYN=false)` : '') +
    (dropped ? `\n  ${dropped} dropped (missing price/address/photos)` : ''),
);
