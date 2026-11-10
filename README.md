# Schach-Training

Ein Eröffnungstrainer fürs Handy. Läuft als Web-App im Browser, lässt sich auf den Homescreen legen und funktioniert offline. Alle Daten bleiben auf dem Gerät.

## Funktionen

- **Eröffnungen lernen:** 12 klassische Eröffnungen mit 38 Linien (Italienisch, Spanisch, Damengambit, Londoner System, Sizilianisch, Französisch, Caro-Kann, Königsindisch …). Erst siehst du die Linie mit einer kurzen Erklärung, dann spielst du sie selbst gegen den Gegner.
- **Eigenes Repertoire:** Linien direkt auf dem Brett eingeben.
- **PGN-Import:** z. B. aus Lichess-Studien; Varianten in Klammern werden zu eigenen Linien.
- **Wiederholungen:** Fehlerfreie Linien kommen in wachsenden Abständen wieder, fehlerhafte schon bald.
- **Statistik:** Fortschritt und Trefferquote pro Eröffnung.
- **Sicherung:** Export und Wiederherstellung als JSON-Datei.

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

## Veröffentlichen

Der Workflow `.github/workflows/deploy.yml` baut die App bei jedem Push auf `main` und veröffentlicht sie über GitHub Pages. Dafür einmalig im Repository unter **Settings → Pages → Source** die Option **GitHub Actions** wählen.

## Auf dem Handy installieren

Die veröffentlichte Adresse im Browser öffnen, dann:

- **iPhone (Safari):** Teilen → „Zum Home-Bildschirm“
- **Android (Chrome):** Menü → „App installieren“ bzw. „Zum Startbildschirm hinzufügen“
