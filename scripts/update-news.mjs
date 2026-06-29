import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const sources = JSON.parse(await fs.readFile(path.join(root, "sources.json"), "utf8"));
const outFile = path.join(root, "data", "news.json");
const now = new Date().toISOString();

const CATEGORY_RULES = [
  ["Gemeinnützigkeit & AO", ["gemeinnützig", "gemeinnuetzig", "steuerbegünst", "steuerbeguenst", "abgabenordnung", "ao ", "§ 52", "§52", "§ 55", "zweckbetrieb", "wirtschaftlicher geschäftsbetrieb", "mittelverwendung", "freistellungsbescheid"]],
  ["Steuerrecht allgemein", ["steuer", "steuern", "finanzamt", "körperschaftsteuer", "koerperschaftsteuer", "gewerbesteuer", "lohnsteuer", "jahressteuergesetz", "steueränder", "steuerentlast", "vereine"]],
  ["Spenden & Zuwendungen", ["spende", "spenden", "zuwendung", "zuwendungsbestätigung", "zuwendungsbestaetigung", "spendenquittung", "sachspende", "aufwandsspende", "mitgliedsbeitrag"]],
  ["Umsatzsteuer & E-Rechnung", ["umsatzsteuer", "ust", "e-rechnung", "erechnung", "rechnung", "kleinunternehmer", "sponsoring", "werbung", "veranstaltung", "vermietung", "gastronomie"]],
  ["Übungsleiter/Ehrenamt", ["übungsleiter", "uebungsleiter", "trainer", "ehrenamt", "ehrenamtspauschale", "übungsleiterpauschale", "uebungsleiterpauschale", "aufwandsentschädigung", "aufwandsentschaedigung", "§ 3 nummer 26", "§ 3 nr. 26"]],
  ["Minijob & Sozialversicherung", ["minijob", "geringfügig", "geringfuegig", "sozialversicherung", "beitragsnachweis", "rentenversicherung", "knappschaft", "sozialversicherungsentgelt", "beschäftigung", "beschaeftigung"]],
  ["Personal & Arbeitsrecht", ["arbeitsrecht", "arbeitsvertrag", "arbeitnehmer", "arbeitgeber", "arbeitszeit", "nachweisgesetz", "urlaub", "befristung", "teilzeit", "entgeltfortzahlung", "honorarkraft", "scheinselbst", "beschäftigte", "beschaeftigte"]],
  ["Mindestlohn", ["mindestlohn", "mindestrichtlinie", "lohnuntergrenze", "finanzkontrolle schwarzarbeit", "milog"]],
  ["Arbeitsschutz & Unfallversicherung", ["arbeitsschutz", "unfallversicherung", "berufsgenossenschaft", "vbg", "versicherungsschutz", "unfall", "sicherheit", "sportversicherung"]],
  ["Vereinsrecht & Compliance", ["verein", "vereinsrecht", "vorstand", "mitgliederversammlung", "satzung", "register", "transparenzregister", "datenschutz", "compliance", "haftung", "bgb"]],
  ["Förderung & Digitalisierung", ["förderung", "foerderung", "zuschuss", "zuwendung", "digitalisierung", "elster", "online", "portal", "bürokratie", "buerokratie"]]
];

const RELEVANT_BASE = ["verein", "vereine", "sport", "gemeinnützig", "gemeinnuetzig", "ehrenamt", "vorstand", "arbeitgeber", "minijob", "mindestlohn", "steuer", "spende", "umsatzsteuer", "sozialversicherung", "arbeitsrecht", "übungsleiter", "uebungsleiter", "trainer", "vereinssatzung", "zuwendung"];

const CATEGORY_ACTIONS = {
  "Gemeinnützigkeit & AO": ["Gemeinnützigkeitsrisiko prüfen", "Satzung, tatsächliche Geschäftsführung, Mittelverwendung und Nachweise kontrollieren."],
  "Steuerrecht allgemein": ["Steuerliche Einordnung prüfen", "Mit Steuerkanzlei klären, ob Körperschaftsteuer, Gewerbesteuer, Lohnsteuer oder Erklärungspflichten betroffen sind."],
  "Spenden & Zuwendungen": ["Spendenprozess prüfen", "Vorlagen, Belege und Zuwendungsbestätigungen auf Aktualität und Zulässigkeit kontrollieren."],
  "Umsatzsteuer & E-Rechnung": ["Umsatzsteuer-Prozess prüfen", "Einnahmenbereich, Rechnungsstellung, Sponsoring und Veranstaltungen getrennt bewerten."],
  "Übungsleiter/Ehrenamt": ["Vergütungsmodell prüfen", "Nebenberuflichkeit, Tätigkeitsbeschreibung, Beschluss und Zahlungen dokumentieren."],
  "Minijob & Sozialversicherung": ["Personalabrechnung prüfen", "Entgeltgrenzen, Meldungen, Pauschalen, Arbeitszeit und Sozialversicherung mit Lohnstelle abgleichen."],
  "Personal & Arbeitsrecht": ["Arbeitsverhältnisse prüfen", "Verträge, Nachweise, Befristungen, Arbeitszeit, Urlaub und Statusfragen intern nachziehen."],
  "Mindestlohn": ["Stunden/Entgelt prüfen", "Für alle bezahlten Tätigkeiten prüfen, ob Mindestlohn, Aufzeichnungspflichten und Status korrekt umgesetzt sind."],
  "Arbeitsschutz & Unfallversicherung": ["Schutzpflichten prüfen", "Arbeitsschutz, Versicherungsschutz und Zuständigkeit für Ehrenamtliche/Beschäftigte klären."],
  "Vereinsrecht & Compliance": ["Beschluss-/Satzungslage prüfen", "Vorstand, Geschäftsordnung, Register, Datenschutz und Haftungsfragen kontrollieren."],
  "Förderung & Digitalisierung": ["Umsetzungschance prüfen", "Förderfähigkeit, Fristen, technische Anforderungen und interne Zuständigkeit bewerten."]
};

function decodeEntities(s = "") {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
}
function stripHtml(s = "") {
  return decodeEntities(s).replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
function inner(xml, tag) {
  const m = xml.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return m ? stripHtml(m[1]) : "";
}
function linkFrom(entry) {
  const mHref = entry.match(/<link\b[^>]*href=["']([^"']+)["'][^>]*>/i);
  if (mHref) return decodeEntities(mHref[1]);
  return inner(entry, "link");
}
function absolutize(url, base) {
  try { return new URL(url, base).toString(); } catch { return url || base; }
}
function hash(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24); }
  return (h >>> 0).toString(16);
}
function categoriesFor(text) {
  const lower = ` ${text.toLowerCase()} `;
  const cats = [];
  for (const [cat, kws] of CATEGORY_RULES) if (kws.some(k => lower.includes(k))) cats.push(cat);
  return [...new Set(cats)];
}
function relevantEnough(text, cats) {
  const lower = text.toLowerCase();
  const hits = RELEVANT_BASE.filter(k => lower.includes(k)).length;
  return cats.length >= 2 || hits >= 1;
}
function impactFor(cats, text) {
  const lower = text.toLowerCase();
  if (cats.some(c => ["Gemeinnützigkeit & AO", "Minijob & Sozialversicherung", "Mindestlohn", "Umsatzsteuer & E-Rechnung"].includes(c))) return "hoch";
  if (lower.includes("pflicht") || lower.includes("gesetz") || lower.includes("frist") || lower.includes("änder")) return "hoch";
  if (cats.some(c => ["Personal & Arbeitsrecht", "Spenden & Zuwendungen", "Übungsleiter/Ehrenamt"].includes(c))) return "mittel";
  return "niedrig";
}
function makeAction(cats) {
  const main = cats[0] || "Steuerrecht allgemein";
  const [rel, action] = CATEGORY_ACTIONS[main] || ["Prüfen", "Originalquelle lesen und intern bewerten."];
  return { relevance: rel, action };
}
async function fetchText(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { "user-agent": "Sportverein-Rechtsmonitor/1.0 (+GitHub Actions)" } });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return await res.text();
  } finally { clearTimeout(timer); }
}
function parseFeed(xml, baseUrl) {
  const items = [];
  const rss = [...xml.matchAll(/<item\b[\s\S]*?<\/item>/gi)].map(m => m[0]);
  const atom = [...xml.matchAll(/<entry\b[\s\S]*?<\/entry>/gi)].map(m => m[0]);
  for (const raw of rss.length ? rss : atom) {
    const title = inner(raw, "title");
    const summary = inner(raw, "description") || inner(raw, "summary") || inner(raw, "content") || inner(raw, "content:encoded");
    const link = absolutize(linkFrom(raw), baseUrl);
    const date = inner(raw, "pubDate") || inner(raw, "updated") || inner(raw, "published") || inner(raw, "dc:date");
    if (title && link) items.push({ title, summary, url: link, publishedAt: date ? new Date(date).toISOString() : null });
  }
  return items;
}
function discoverFeeds(html, baseUrl) {
  const feeds = new Set();
  const re = /<link\b[^>]*rel=["'][^"']*alternate[^"']*["'][^>]*>/gi;
  for (const tag of html.match(re) || []) {
    if (!/rss|atom|xml/i.test(tag)) continue;
    const href = tag.match(/href=["']([^"']+)["']/i)?.[1];
    if (href) feeds.add(absolutize(decodeEntities(href), baseUrl));
  }
  return [...feeds];
}
function discoverPageLinks(html, baseUrl) {
  const out = [];
  const re = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  for (const m of html.matchAll(re)) {
    const href = m[1].match(/href=["']([^"']+)["']/i)?.[1];
    const text = stripHtml(m[2]);
    if (!href || !text || text.length < 8) continue;
    const url = absolutize(decodeEntities(href), baseUrl);
    if (!url.startsWith("http")) continue;
    out.push({ title: text.slice(0, 180), url });
  }
  return out;
}
async function collectSource(source) {
  const status = { name: source.name, type: source.type, home: source.home, ok: false, itemsFound: 0, error: "" };
  const collected = [];
  const feedSet = new Set(source.feeds || []);
  const discoveryPages = [source.home, ...(source.pages || [])].filter(Boolean);

  for (const page of discoveryPages.slice(0, 3)) {
    try {
      const html = await fetchText(page);
      discoverFeeds(html, page).forEach(f => feedSet.add(f));
      for (const link of discoverPageLinks(html, page).slice(0, 100)) {
        const text = `${link.title} ${link.url}`;
        const cats = categoriesFor(text);
        if (!relevantEnough(text, cats)) continue;
        const { relevance, action } = makeAction(cats);
        collected.push({
          id: `link-${hash(link.url)}`,
          type: "Quellenfund",
          title: link.title,
          summary: "Dieser Link wurde beim automatischen Abruf auf einer überwachten Quelle gefunden und nach Vereins-/Steuer-/Personal-Schlüsselwörtern eingeordnet.",
          sourceName: source.name,
          url: link.url,
          publishedAt: null,
          foundAt: now,
          categories: cats.length ? cats : ["Vereinsrecht & Compliance"],
          impact: impactFor(cats, text),
          relevance,
          action
        });
      }
      status.ok = true;
    } catch (err) {
      status.error = `${page}: ${err.message}`;
    }
  }

  for (const feed of [...feedSet].slice(0, 8)) {
    try {
      const xml = await fetchText(feed);
      const parsed = parseFeed(xml, feed);
      for (const item of parsed.slice(0, 80)) {
        const text = `${item.title} ${item.summary} ${item.url}`;
        const cats = categoriesFor(text);
        if (!relevantEnough(text, cats)) continue;
        const { relevance, action } = makeAction(cats);
        collected.push({
          id: `feed-${hash(item.url || item.title)}`,
          type: "Aktuelle Meldung",
          title: item.title,
          summary: item.summary || "Aktuelle Meldung aus einer überwachten Quelle.",
          sourceName: source.name,
          url: item.url,
          publishedAt: item.publishedAt,
          foundAt: now,
          categories: cats.length ? cats : ["Steuerrecht allgemein"],
          impact: impactFor(cats, text),
          relevance,
          action
        });
      }
      status.ok = true;
    } catch (err) {
      status.error = status.error || `${feed}: ${err.message}`;
    }
  }

  status.itemsFound = collected.length;
  return { status, items: collected };
}

const errors = [];
const sourceStatuses = [];
const all = [];
for (const source of sources) {
  try {
    const { status, items } = await collectSource(source);
    sourceStatuses.push(status);
    all.push(...items);
    if (!status.ok && status.error) errors.push(`${source.name}: ${status.error}`);
  } catch (err) {
    errors.push(`${source.name}: ${err.message}`);
    sourceStatuses.push({ name: source.name, type: source.type, home: source.home, ok: false, itemsFound: 0, error: err.message });
  }
}

const byKey = new Map();
for (const item of all) {
  const key = (item.url || item.title).toLowerCase().replace(/[#?].*$/, "");
  if (!byKey.has(key)) byKey.set(key, item);
}
let items = [...byKey.values()];
items.sort((a, b) => new Date(b.publishedAt || b.foundAt || 0) - new Date(a.publishedAt || a.foundAt || 0));
items = items.slice(0, 250);

const payload = {
  meta: {
    generatedAt: now,
    itemCount: items.length,
    sourceCount: sources.length,
    generator: "scripts/update-news.mjs",
    note: "Automatisch generierte Informationsübersicht. Keine Rechts- oder Steuerberatung.",
    errors
  },
  sources: sourceStatuses,
  items
};
await fs.mkdir(path.dirname(outFile), { recursive: true });
await fs.writeFile(outFile, JSON.stringify(payload, null, 2) + "\n", "utf8");
console.log(`Wrote ${items.length} items to ${outFile}`);
if (errors.length) console.log(`Hinweise: ${errors.length}`);
