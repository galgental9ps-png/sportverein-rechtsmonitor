/* Sportverein Rechtsmonitor — statische GitHub-Pages-App */
const APP = {
  passwordHash: "cafd928984f4df70dd435f5448ab1fd53601554956608c7eff6f90db6a8cfebd", // SHA-256 von "Doris"
  storagePrefix: "sportverein-rechtsmonitor-v1",
  dataUrl: "data/news.json",
  basicsUrl: "data/basics.json",
  state: {
    authed: localStorage.getItem("sportverein-rechtsmonitor-v1-auth") === "1",
    tab: "monitor",
    query: "",
    category: "Alle",
    impact: "Alle",
    source: "Alle",
    type: "Alle",
    onlyUnread: false,
    data: null,
    basics: null,
    read: new Set(JSON.parse(localStorage.getItem("sportverein-rechtsmonitor-v1-read") || "[]")),
    pinned: new Set(JSON.parse(localStorage.getItem("sportverein-rechtsmonitor-v1-pinned") || "[]")),
    checks: JSON.parse(localStorage.getItem("sportverein-rechtsmonitor-v1-checks") || "{}"),
    notes: localStorage.getItem("sportverein-rechtsmonitor-v1-notes") || ""
  }
};

const CATEGORIES = [
  "Alle",
  "Gemeinnützigkeit & AO",
  "Steuerrecht allgemein",
  "Spenden & Zuwendungen",
  "Umsatzsteuer & E-Rechnung",
  "Übungsleiter/Ehrenamt",
  "Minijob & Sozialversicherung",
  "Personal & Arbeitsrecht",
  "Mindestlohn",
  "Arbeitsschutz & Unfallversicherung",
  "Vereinsrecht & Compliance",
  "Förderung & Digitalisierung"
];

const CHECKLIST = [
  { id: "gemein", title: "Gemeinnützigkeit aktuell prüfen", text: "Satzung, tatsächliche Geschäftsführung, Mittelverwendung, Rücklagen und Zweckbetrieb/wirtschaftlicher Geschäftsbetrieb jährlich dokumentieren." },
  { id: "pauschalen", title: "Übungsleiter- und Ehrenamtspauschalen prüfen", text: "Verträge, Nebenberuflichkeit, Tätigkeitsbereich und Jahresgrenzen dokumentieren; Kombination mit Minijob nur sauber trennen." },
  { id: "minijob", title: "Minijobs und kurzfristige Beschäftigung prüfen", text: "Entgeltgrenzen, Meldungen, Umlagen, Rentenversicherung und Mindestlohnbezug überwachen." },
  { id: "mindestlohn", title: "Mindestlohn und Arbeitszeiten prüfen", text: "Alle bezahlten Kräfte, Trainer, Platzwarte, Bürokräfte, FSJ/BFD-Konstellationen und Honorarkräfte rechtlich einordnen." },
  { id: "ust", title: "Umsatzsteuer und E-Rechnung beobachten", text: "Leistungen, Sponsoring, Veranstaltungen, Vermietung, Gastronomie, Sportkurse und Rechnungsstellung kategorisieren." },
  { id: "spenden", title: "Spendenquittungen/Zuwendungsbestätigungen kontrollieren", text: "Nur zulässige Zuwendungen bescheinigen; Mitgliedsbeiträge, Aufwandsspenden und Sachspenden sauber dokumentieren." },
  { id: "vertrag", title: "Arbeits-, Honorar- und Ehrenamtsverträge sammeln", text: "Einheitliche Vertragsablage mit Status: Arbeitnehmer, Minijob, selbstständig, ehrenamtlich, Übungsleiter." },
  { id: "protokoll", title: "Vorstandsbeschlüsse protokollieren", text: "Beschlüsse zu Vergütungen, Aufwandsersatz, Rücklagen, größeren Ausgaben und Satzungsfragen nachvollziehbar ablegen." }
];

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k === "html") node.innerHTML = v;
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.substring(2), v);
    else if (v !== false && v !== undefined && v !== null) node.setAttribute(k, v === true ? "" : v);
  }
  for (const child of Array.isArray(children) ? children : [children]) {
    if (child === null || child === undefined) continue;
    node.append(child.nodeType ? child : document.createTextNode(String(child)));
  }
  return node;
}

function fmtDate(value) {
  if (!value) return "ohne Datum";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: value.includes("T") ? "short" : undefined }).format(d);
}

function getItems() {
  const news = APP.state.data?.items || [];
  const basics = APP.state.basics?.items || [];
  return [...news, ...basics].map(x => ({...x, categories: x.categories || [x.category || "Sonstiges"]}));
}

function scoreDashboard(items) {
  const now = Date.now();
  const recent = items.filter(i => i.publishedAt && now - new Date(i.publishedAt).getTime() < 1000 * 60 * 60 * 24 * 45).length;
  const high = items.filter(i => i.impact === "hoch").length;
  const unread = items.filter(i => !APP.state.read.has(i.id)).length;
  return { total: items.length, recent, high, unread };
}

async function sha256(text) {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function loadData() {
  try {
    const [newsRes, basicsRes] = await Promise.all([
      fetch(`${APP.dataUrl}?v=${Date.now()}`, { cache: "no-store" }),
      fetch(`${APP.basicsUrl}?v=${Date.now()}`, { cache: "no-store" })
    ]);
    APP.state.data = newsRes.ok ? await newsRes.json() : { meta: { generatedAt: null, errors: ["data/news.json konnte nicht geladen werden."] }, items: [], sources: [] };
    APP.state.basics = basicsRes.ok ? await basicsRes.json() : { items: [] };
  } catch (err) {
    APP.state.data = { meta: { generatedAt: null, errors: [String(err)] }, items: [], sources: [] };
    APP.state.basics = { items: [] };
  }
}

function saveSets() {
  localStorage.setItem(`${APP.storagePrefix}-read`, JSON.stringify([...APP.state.read]));
  localStorage.setItem(`${APP.storagePrefix}-pinned`, JSON.stringify([...APP.state.pinned]));
}

function filteredItems() {
  const q = APP.state.query.trim().toLowerCase();
  let items = getItems();
  if (APP.state.category !== "Alle") items = items.filter(i => i.categories.includes(APP.state.category));
  if (APP.state.impact !== "Alle") items = items.filter(i => (i.impact || "mittel") === APP.state.impact);
  if (APP.state.source !== "Alle") items = items.filter(i => i.sourceName === APP.state.source);
  if (APP.state.type !== "Alle") items = items.filter(i => (i.type || "Meldung") === APP.state.type);
  if (APP.state.onlyUnread) items = items.filter(i => !APP.state.read.has(i.id));
  if (q) {
    items = items.filter(i => [i.title, i.summary, i.relevance, i.action, i.sourceName, ...(i.categories || [])].filter(Boolean).join(" ").toLowerCase().includes(q));
  }
  items.sort((a, b) => {
    const pin = Number(APP.state.pinned.has(b.id)) - Number(APP.state.pinned.has(a.id));
    if (pin) return pin;
    const impactOrder = { hoch: 3, mittel: 2, niedrig: 1 };
    const io = (impactOrder[b.impact] || 2) - (impactOrder[a.impact] || 2);
    if (io) return io;
    return new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0);
  });
  return items;
}

function renderLogin(root) {
  root.replaceChildren(el("div", { class: "login-wrap" }, [
    el("div", { class: "login-card" }, [
      el("div", { class: "logo-row" }, [el("div", { class: "logo" }, "SV"), el("strong", {}, "Geschäftsführung · gemeinnütziger Sportverein")]),
      el("h1", {}, "Rechts- und Steuer-Monitor"),
      el("p", {}, "Interne Übersicht für steuerrechtliche, personalrechtliche und vereinsrechtliche Neuerungen mit Quellen. Die Daten werden per GitHub Actions zweimal täglich aktualisiert."),
      el("form", { class: "login-form", onsubmit: async (e) => {
        e.preventDefault();
        const input = e.currentTarget.querySelector("input");
        const err = e.currentTarget.querySelector(".err");
        const hash = await sha256(input.value);
        if (hash === APP.passwordHash) {
          localStorage.setItem(`${APP.storagePrefix}-auth`, "1");
          APP.state.authed = true;
          await loadData();
          render();
        } else {
          err.textContent = "Passwort stimmt nicht.";
          input.select();
        }
      }}, [
        el("label", {}, "Passwort"),
        el("input", { type: "password", autocomplete: "current-password", autofocus: true, placeholder: "Passwort eingeben" }),
        el("button", { class: "primary", type: "submit" }, "App öffnen"),
        el("div", { class: "err" }, ""),
        el("p", { class: "small" }, "Hinweis: GitHub Pages ist statisch. Dieses Passwort schützt praktisch vor normalem Zugriff, ist aber keine echte Server-Authentifizierung.")
      ])
    ])
  ]));
}

function renderHero(items) {
  const stats = scoreDashboard(items);
  const generated = APP.state.data?.meta?.generatedAt;
  return el("section", { class: "hero" }, [
    el("div", { class: "hero-top" }, [
      el("div", {}, [
        el("h1", {}, "Sportverein Rechtsmonitor"),
        el("p", {}, "Kategorisierte Übersicht für Geschäftsführung, Vorstand und Verwaltung eines gemeinnützigen Sportvereins: Steuerrecht, Gemeinnützigkeit, Personal, Minijobs, Mindestlohn, Vereinsrecht und Compliance – jeweils mit Quellen und Handlungshinweisen.")
      ]),
      el("div", { class: "hero-actions" }, [
        el("button", { class: "secondary", onclick: () => exportState() }, "Fortschritt exportieren"),
        el("button", { class: "ghost", onclick: () => { localStorage.removeItem(`${APP.storagePrefix}-auth`); APP.state.authed = false; render(); } }, "Abmelden")
      ])
    ]),
    el("div", { class: "hero-grid" }, [
      stat("Einträge", stats.total),
      stat("Neue/aktuelle Treffer", stats.recent),
      stat("Hohe Relevanz", stats.high),
      stat("Ungelesen", stats.unread)
    ]),
    el("p", { class: "small", style: "margin-top:16px;color:rgba(255,255,255,.78)" }, `Letzte automatische Aktualisierung: ${generated ? fmtDate(generated) : "noch nicht erfolgt"}. Automatik: 2× täglich über GitHub Actions.`)
  ]);
}
function stat(label, value) { return el("div", { class: "stat" }, [el("strong", {}, value), el("span", {}, label)]); }

function renderTabs() {
  const tabs = [
    ["monitor", "Monitor"],
    ["checklist", "To-do-Liste"],
    ["sources", "Quellen"],
    ["notes", "Notizen"],
    ["setup", "GitHub-Setup"]
  ];
  return el("div", { class: "tabs" }, tabs.map(([id, label]) => el("button", {
    class: `tab ${APP.state.tab === id ? "active" : ""}`,
    onclick: () => { APP.state.tab = id; render(); }
  }, label)));
}

function renderToolbar(items) {
  const sources = ["Alle", ...Array.from(new Set(items.map(i => i.sourceName).filter(Boolean))).sort()];
  const types = ["Alle", ...Array.from(new Set(items.map(i => i.type || "Meldung").filter(Boolean))).sort()];
  return el("div", { class: "toolbar" }, [
    el("input", { placeholder: "Suchen: z. B. Spenden, Minijob, Mindestlohn, Umsatzsteuer …", value: APP.state.query, oninput: e => { APP.state.query = e.target.value; renderMainOnly(); } }),
    select(CATEGORIES, APP.state.category, v => { APP.state.category = v; renderMainOnly(); }),
    select(["Alle", "hoch", "mittel", "niedrig"], APP.state.impact, v => { APP.state.impact = v; renderMainOnly(); }),
    select(sources, APP.state.source, v => { APP.state.source = v; renderMainOnly(); }),
    select(types, APP.state.type, v => { APP.state.type = v; renderMainOnly(); })
  ]);
}
function select(values, current, onChange) {
  const s = el("select", { onchange: e => onChange(e.target.value) }, values.map(v => el("option", { value: v, selected: v === current }, v)));
  return s;
}

function categoryCounts(items) {
  const counts = Object.fromEntries(CATEGORIES.map(c => [c, 0]));
  counts.Alle = items.length;
  for (const item of items) for (const cat of item.categories || []) counts[cat] = (counts[cat] || 0) + 1;
  return counts;
}

function renderSide(items) {
  const counts = categoryCounts(items);
  return el("aside", { class: "side" }, [
    el("h2", {}, "Kategorien"),
    el("div", { class: "category-list" }, CATEGORIES.map(c => el("button", { class: `category-button ${APP.state.category === c ? "active" : ""}`, onclick: () => { APP.state.category = c; renderMainOnly(); } }, [el("span", {}, c), el("span", { class: "badge" }, counts[c] || 0)]))),
    el("hr", { style: "border:0;border-top:1px solid var(--line);margin:16px 0" }),
    el("label", { class: "check-row" }, [
      el("input", { type: "checkbox", checked: APP.state.onlyUnread, onchange: e => { APP.state.onlyUnread = e.target.checked; renderMainOnly(); } }),
      el("span", {}, "Nur ungelesene Einträge anzeigen")
    ]),
    el("p", { class: "small" }, "Tipp: Einträge als gelesen markieren, pinnen oder über die Quelle im Original prüfen.")
  ]);
}

function renderCards(items) {
  if (!items.length) return el("div", { class: "card empty" }, "Keine Einträge zu den aktuellen Filtern gefunden.");
  return el("div", { class: "cards" }, items.map(renderCard));
}

function renderCard(item) {
  const isRead = APP.state.read.has(item.id);
  const isPinned = APP.state.pinned.has(item.id);
  return el("article", { class: "card" }, [
    el("div", { class: "card-header" }, [
      el("div", {}, [
        el("div", { class: "chips" }, [
          ...((item.categories || []).slice(0, 3).map(c => el("span", { class: "chip" }, c))),
          el("span", { class: `chip impact-${item.impact || "mittel"}` }, `Relevanz: ${item.impact || "mittel"}`),
          item.type ? el("span", { class: "chip" }, item.type) : null
        ]),
        el("h3", {}, item.title || "Ohne Titel")
      ]),
      el("div", { class: "chips" }, [
        isPinned ? el("span", { class: "chip" }, "gepinnt") : null,
        isRead ? el("span", { class: "chip" }, "gelesen") : el("span", { class: "chip" }, "neu")
      ])
    ]),
    el("p", {}, item.summary || "Keine Kurzbeschreibung vorhanden."),
    el("div", { class: "info-grid" }, [
      el("div", { class: "info-box" }, [el("b", {}, "Warum relevant?"), el("span", {}, item.relevance || "Für gemeinnützige Sportvereine prüfen, ob Pflichten oder Gestaltungsmöglichkeiten betroffen sind.")]),
      el("div", { class: "info-box" }, [el("b", {}, "Empfohlene Aktion"), el("span", {}, item.action || "Originalquelle öffnen, Änderung intern bewerten und bei Bedarf Steuerkanzlei/Fachberatung einbeziehen.")])
    ]),
    el("div", { class: "meta" }, [
      el("span", {}, `Quelle: ${item.sourceName || "unbekannt"}`),
      el("span", {}, `Datum: ${fmtDate(item.publishedAt)}`),
      item.foundAt ? el("span", {}, `Gefunden: ${fmtDate(item.foundAt)}`) : null
    ]),
    el("div", { class: "card-actions" }, [
      item.url ? el("a", { class: "primary", href: item.url, target: "_blank", rel: "noopener" }, "Quelle öffnen") : null,
      el("button", { class: "secondary", onclick: () => { toggleRead(item.id); } }, isRead ? "Als ungelesen" : "Als gelesen"),
      el("button", { class: "ghost", onclick: () => { togglePin(item.id); } }, isPinned ? "Pin entfernen" : "Pinnen")
    ])
  ]);
}

function toggleRead(id) { APP.state.read.has(id) ? APP.state.read.delete(id) : APP.state.read.add(id); saveSets(); render(); }
function togglePin(id) { APP.state.pinned.has(id) ? APP.state.pinned.delete(id) : APP.state.pinned.add(id); saveSets(); render(); }

function renderMonitor() {
  const all = getItems();
  const filtered = filteredItems();
  return el("div", {}, [
    renderToolbar(all),
    el("div", { class: "layout" }, [renderSide(all), el("main", { id: "mainPanel" }, renderCards(filtered))])
  ]);
}

function renderChecklist() {
  return el("div", { class: "panel", style: "padding:18px" }, [
    el("h2", {}, "To-do-Liste für Geschäftsführung/Vorstand"),
    el("p", { class: "small" }, "Die Haken werden lokal im Browser gespeichert."),
    el("div", { class: "checklist" }, CHECKLIST.map(item => el("label", { class: "check-row" }, [
      el("input", { type: "checkbox", checked: !!APP.state.checks[item.id], onchange: e => { APP.state.checks[item.id] = e.target.checked; localStorage.setItem(`${APP.storagePrefix}-checks`, JSON.stringify(APP.state.checks)); } }),
      el("span", {}, [el("b", {}, item.title), el("br"), el("span", { class: "small" }, item.text)])
    ])))
  ]);
}

function renderSources() {
  const sources = APP.state.data?.sources || [];
  return el("div", { class: "panel", style: "padding:18px;overflow:auto" }, [
    el("h2", {}, "Quellen und Abrufstatus"),
    el("p", { class: "small" }, "Die App bevorzugt offizielle und vereinsnahe Quellen. Beim automatischen Lauf werden RSS-/Atom-Feeds gesucht oder direkt abgerufen und nach Vereins-/Steuer-/Personal-Schlüsselwörtern gefiltert."),
    el("table", { class: "source-table" }, [
      el("thead", {}, el("tr", {}, ["Quelle", "Typ", "Status", "Treffer", "Link"].map(h => el("th", {}, h)))),
      el("tbody", {}, sources.map(s => el("tr", {}, [
        el("td", {}, s.name),
        el("td", {}, s.type || "Quelle"),
        el("td", { class: s.ok ? "status-ok" : "status-warn" }, s.ok ? "ok" : (s.error ? "Hinweis" : "offen")),
        el("td", {}, s.itemsFound ?? 0),
        el("td", {}, s.home ? el("a", { href: s.home, target: "_blank", rel: "noopener" }, "öffnen") : "—")
      ])))
    ]),
    ...(APP.state.data?.meta?.errors?.length ? [el("h3", {}, "Abrufhinweise"), el("ul", {}, APP.state.data.meta.errors.map(e => el("li", {}, e)))] : [])
  ]);
}

function renderNotes() {
  return el("div", { class: "panel", style: "padding:18px" }, [
    el("h2", {}, "Interne Notizen"),
    el("p", { class: "small" }, "Lokal im Browser gespeichert. Für echte Vereinsdokumentation bitte zusätzlich in eurem Ablagesystem sichern."),
    el("textarea", { class: "note-area", placeholder: "z. B. Rückfrage an Steuerkanzlei, Beschlussbedarf, offene Verträge …", oninput: e => { APP.state.notes = e.target.value; localStorage.setItem(`${APP.storagePrefix}-notes`, e.target.value); } }, APP.state.notes),
    el("div", { class: "card-actions" }, [
      el("button", { class: "secondary", onclick: () => { navigator.clipboard?.writeText(APP.state.notes); } }, "Notizen kopieren"),
      el("button", { class: "ghost", onclick: () => { if (confirm("Notizen wirklich löschen?")) { APP.state.notes = ""; localStorage.removeItem(`${APP.storagePrefix}-notes`); render(); } } }, "Leeren")
    ])
  ]);
}

function renderSetup() {
  return el("div", { class: "panel", style: "padding:18px" }, [
    el("h2", {}, "GitHub-Setup für automatische Aktualisierung"),
    el("p", {}, "Für diese App muss GitHub Pages über GitHub Actions laufen, nicht nur über „Deploy from a branch“. Der Workflow aktualisiert die Quellen zweimal täglich und veröffentlicht danach die statische Seite."),
    el("ol", {}, [
      el("li", {}, "ZIP entpacken und alle Dateien inklusive Ordner „.github“ hochladen."),
      el("li", {}, "Repository → Settings → Pages → Source auf „GitHub Actions“ stellen."),
      el("li", {}, "Oben auf Actions gehen und den Workflow „Update and Deploy Rechtsmonitor“ einmal manuell starten: „Run workflow“."),
      el("li", {}, "Danach läuft der Workflow automatisch ungefähr morgens und abends."),
      el("li", {}, "Bei 404: Actions öffnen und prüfen, ob der letzte Lauf grün war.")
    ]),
    el("p", { class: "small" }, "Wichtig: GitHub führt Zeitpläne in UTC aus; bei hoher Last kann sich der Lauf verzögern. Die App ersetzt keine Rechts- oder Steuerberatung.")
  ]);
}

function exportState() {
  const blob = new Blob([JSON.stringify({ read: [...APP.state.read], pinned: [...APP.state.pinned], checks: APP.state.checks, notes: APP.state.notes, exportedAt: new Date().toISOString() }, null, 2)], { type: "application/json" });
  const a = el("a", { href: URL.createObjectURL(blob), download: `rechtsmonitor-fortschritt-${new Date().toISOString().slice(0,10)}.json` });
  document.body.append(a); a.click(); a.remove();
}

function renderMainOnly() {
  const panel = document.getElementById("mainContent");
  if (panel) panel.replaceChildren(renderMonitor());
}

function renderApp(root) {
  const items = getItems();
  let content;
  if (APP.state.tab === "monitor") content = renderMonitor();
  else if (APP.state.tab === "checklist") content = renderChecklist();
  else if (APP.state.tab === "sources") content = renderSources();
  else if (APP.state.tab === "notes") content = renderNotes();
  else content = renderSetup();
  root.replaceChildren(el("div", { class: "shell" }, [
    renderHero(items),
    renderTabs(),
    el("section", { id: "mainContent" }, content),
    el("p", { class: "footer-note" }, "Hinweis: Dieser Monitor ist eine strukturierte Informationsübersicht mit Quellen. Er ist keine steuerliche oder arbeitsrechtliche Beratung. Verbindliche Bewertung immer mit Steuerkanzlei, Rechtsberatung oder zuständiger Stelle klären.")
  ]));
}

async function render() {
  const root = document.getElementById("app");
  if (!APP.state.authed) return renderLogin(root);
  if (!APP.state.data) await loadData();
  renderApp(root);
}

render();
