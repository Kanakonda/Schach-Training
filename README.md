# Schach-Training

Ein Eröffnungstrainer fürs Handy. Läuft als Web-App im Browser, lässt sich auf den Homescreen legen und funktioniert offline. Alle Daten bleiben auf dem Gerät.

## Funktionen

- **Eröffnungen lernen:** über 2.200 Linien aus 97 Eröffnungen. Erst siehst du die Linie, dann spielst du sie selbst gegen den Gegner.
- **Grundkurse:** 12 klassische Eröffnungen mit handgeschriebenen Grundlinien und kurzer Erklärung, ergänzt um alle Varianten aus der Datenbank.
- **Stockfish-Analyse:** zuschaltbar beim Ansehen einer Linie und auf dem freien Analysebrett, mit Bewertungsbalken, den drei besten Varianten und Pfeil für den besten Zug. Die Engine rechnet auf dem Gerät.
- **Farbe wählbar:** Jede Eröffnung lässt sich mit Weiß oder Schwarz trainieren; der Lernstand wird getrennt geführt.
- **Eigenes Repertoire:** Linien direkt auf dem Brett eingeben oder als PGN importieren, z. B. aus Lichess-Studien. Varianten in Klammern werden zu eigenen Linien.
- **Wiederholungen:** Fehlerfreie Linien kommen in wachsenden Abständen wieder, fehlerhafte schon bald.
- **Statistik und Sicherung:** Fortschritt und Trefferquote pro Eröffnung, Export und Wiederherstellung als JSON-Datei.

## Entwicklung

```bash
npm install
npm run dev
```

```bash
npm test
```

```bash
npm run build
```

## Eröffnungsdatenbank

`src/data/db.json` wird aus dem Datensatz [lichess-org/chess-openings](https://github.com/lichess-org/chess-openings) erzeugt. Das Skript nimmt alle benannten Varianten, die kein Anfang einer längeren Variante sind, setzt kurze Linien mit Stockfish bis zum 7. Zug fort und bewertet jede Schlussstellung. Die Namen der Varianten sind die international üblichen englischen Bezeichnungen.

Neu erzeugen (dauert je nach Rechner 30 bis 60 Minuten):

```bash
git clone https://github.com/lichess-org/chess-openings
```

```bash
npm install --no-save stockfish
```

```bash
node scripts/build-db.mjs chess-openings
```

## Veröffentlichen

Der Workflow `.github/workflows/deploy.yml` baut die App bei jedem Push auf `main` und veröffentlicht sie über GitHub Pages. Dafür einmalig im Repository unter **Settings → Pages → Source** die Option **GitHub Actions** wählen.

## Auf dem Handy installieren

Die veröffentlichte Adresse im Browser öffnen, dann:

- **iPhone (Safari):** Teilen → „Zum Home-Bildschirm“
- **Android (Chrome):** Menü → „App installieren“ bzw. „Zum Startbildschirm hinzufügen“

## Quellen und Lizenzen

- **Eröffnungsdaten:** [lichess-org/chess-openings](https://github.com/lichess-org/chess-openings), CC0 1.0.
- **Engine:** Stockfish 19 als [Stockfish.js](https://github.com/nmrugg/stockfish.js) (Variante „lite, single-threaded“), unverändert unter `public/engine/` abgelegt. Stockfish steht unter der GNU GPL v3; der Lizenztext liegt in `public/engine/COPYING.txt`, der Quelltext im verlinkten Repository. Die App startet die Engine als eigenständiges Programm in einem Web Worker und spricht mit ihr über das UCI-Protokoll.
