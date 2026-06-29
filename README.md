# Sportverein Rechtsmonitor

Web-App für die Geschäftsführung eines gemeinnützigen Sportvereins. Sie listet steuerrechtliche, personalrechtliche und vereinsrechtliche Informationen in Kategorien mit Quellen und Handlungshinweisen.

## Funktionen

- Passwort-Gate: `Doris`
- Kategorisierte Informationen: Gemeinnützigkeit/AO, Steuerrecht, Spenden, Umsatzsteuer/E-Rechnung, Übungsleiter/Ehrenamt, Minijob/Sozialversicherung, Personal/Arbeitsrecht, Mindestlohn, Arbeitsschutz, Vereinsrecht/Compliance
- Quellenlinks pro Eintrag
- Such- und Filterfunktion
- Gelesen/Pinnen/Fortschritt lokal im Browser
- Notizen und To-do-Liste
- Automatisches Aktualisieren per GitHub Actions zweimal täglich

## Wichtig

GitHub Pages ist statisch. Das Passwort ist ein praktischer Zugriffsschutz im Browser, aber keine echte Server-Authentifizierung. Wenn das Repository öffentlich ist, kann technisches Personal den Quellcode sehen. Für echte Vertraulichkeit braucht man private Hosting-/Login-Infrastruktur.

Diese App ersetzt keine Steuerberatung oder Rechtsberatung.

## Installation auf GitHub

1. ZIP entpacken.
2. Neues Repository anlegen.
3. Alle Dateien und Ordner hochladen, einschließlich `.github/workflows/update-and-deploy.yml`, `scripts`, `data` und `.nojekyll`.
4. Repository → **Settings → Pages**.
5. **Source: GitHub Actions** auswählen.
6. Oben auf **Actions** gehen.
7. Workflow **Update and Deploy Rechtsmonitor** öffnen.
8. **Run workflow** klicken.
9. Nach grünem Haken den Pages-Link öffnen.

## Aktualisierung

Der Workflow läuft nach Plan:

```yaml
- cron: "17 6,18 * * *"
```

GitHub interpretiert den Zeitplan in UTC. Je nach Sommer-/Winterzeit ist das in Deutschland ungefähr morgens und abends.

## Quellen anpassen

Die Datei `sources.json` enthält die überwachten Quellen. Du kannst weitere offizielle Quellen oder Sportverbandsseiten ergänzen.

## Passwort ändern

In `app.js` steht ein SHA-256-Hash des Passworts. Für ein anderes Passwort:

1. Im Browser oder Terminal SHA-256 des neuen Passworts erzeugen.
2. Den Wert bei `passwordHash` ersetzen.

