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
