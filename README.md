# Wichteln

**Live:** https://zenlosmas.github.io/wichtel/
**Backend:** Supabase `ididedhgyvjlazzdnskk` (eu-central-1), Repo: https://github.com/Zenlosmas/wichtel

Ein Link für die ganze Familie. Jeder öffnet ihn, tippt auf seinen Namen und
sieht, wen er beschenkt. Sobald ein Name gezogen ist, ist er aus dem Topf.

Kein Login, kein Konto, keine App, keine E-Mail.

## Wie es funktioniert

1. **Host:** `/` öffnen, Namen eintragen (mindestens 3), optional Budget und Termin.
   Danach gibt es einen **einen** Teilnehmer-Link und einen Host-Link.
2. **Familie:** Teilnehmer-Link öffnen, eigenen Namen antippen, „Ziehen" drücken.
3. **Ergebnis:** steht auf dem Gerät, das gezogen hat — auch nach einem Reload.
   Wer den Namen nicht kennt, sieht ihn nicht.

## Zwei Design-Entscheidungen, die man kennen muss

**Die Zuteilung wird beim Anlegen berechnet, nicht beim Klick.**
Ein echter Live-Pool hätte ein unlösbares Ende: der Letzte hätte nur sich selbst
übrig. Deshalb wird beim Anlegen ein Derangement gezogen (jeder beschenkt genau
eine Person, niemand sich selbst) und der Klick deckt nur noch auf. Für die
Familie fühlt es sich identisch an.

**Der Link ist die Identität.**
Deshalb ist er ein Geheimnis: nur in die Familiengruppe, nicht öffentlich posten.
Beim Ziehen wird das Ergebnis an einen Zufallsschlüssel im `localStorage`
gebunden. Wer einen fremden Namen antippt, bekommt „Hat schon gezogen" statt der
Zuteilung. Wenn jemand sein Handy wechselt, setzt du den Zug im Host-Link zurück.

## Lokal starten (Demo-Modus)

```bash
npm install
npm run dev
```

Ohne Supabase-Zugang läuft alles im `localStorage`: Runden und Links funktionieren
nur in diesem Browser. Gut zum Ausprobieren, nicht für die Familie.

## Supabase anschließen

1. Projekt in der EU-Region anlegen (Free Tier reicht).
2. `supabase/migrations/0001_wichtel.sql` im SQL-Editor ausführen.
3. `.env` anlegen:
   ```
   VITE_SUPABASE_URL=https://<projekt>.supabase.co
   VITE_SUPABASE_ANON_KEY=<anon-key>
   ```
4. `npm run dev` neu starten. Der Demo-Hinweis verschwindet.

Der Browser liest **keine** Tabelle. RLS ist auf beiden Tabellen aktiv, es gibt
keine Policy für `anon`, und alle Tabellenrechte sind entzogen. Erreichbar sind
nur fünf `security definer`-Funktionen (`wichtel_create`, `wichtel_state`,
`wichtel_host_state`, `wichtel_draw`, `wichtel_reset`). Die Zuteilung verlässt
den Server ausschließlich über `wichtel_draw`, und nur an das Gerät, das zieht.

## Deployen

Gehostet wird auf **GitHub Pages** (kein Vercel-Konto nötig):

```bash
npm run build:pages          # baut mit BASE_PATH=/wichtel/ + 404.html
cd dist && git add -A && git commit -m "Deploy" \
  && git push https://github.com/Zenlosmas/wichtel.git HEAD:gh-pages
```

`dist/` ist ein eigenes Git-Repo (gitignored), das nur den Build enthält.
`404.html` ist eine Kopie von `index.html`, damit `/w/…` und `/h/…` auch beim
Direktaufruf funktionieren.

**Bekannter Schönheitsfehler:** GitHub Pages liefert für solche Direktaufrufe
HTTP 404 (mit korrektem Inhalt). Im Browser egal, in der Konsole steht ein
roter Eintrag. Wer das weghaben will, stellt `BrowserRouter` auf `HashRouter`
um — dann wird der Link `…/wichtel/#/w/abc`, aber jeder Aufruf antwortet mit 200.

## Tests

```bash
npm test                      # 28 Unit-Tests, ohne Netz
./scripts/smoke-backend.sh    # 13 Checks gegen das echte Supabase
```

28 Unit-Tests: Derangement (1000 Runden, nie ein Fixpunkt, jede Zuteilung genau
einmal), Namensprüfung, Zug-Semantik (erster Zug, gleiches Gerät, fremdes Gerät,
Reset), und dass der Zustand die Zuteilung nie enthält.

## Annahmen

- Ein Link für alle statt ein Link pro Person — so gewünscht. Preis: der Link
  ist ein Geheimnis, und ein Fehlklick belegt einen Namen, bis der Host ihn
  zurücksetzt.
- Ergebnis ist gerätegebunden. Bewusster Tausch: kein Leak gegen den Fall
  „Handy gewechselt" — dafür gibt es den Reset im Host-Link.
- „Noch zu vergeben" zeigt, welche Namen schon weg sind, nicht wer sie hat.
  Beim vorletzten Zug ist damit absehbar, was übrig bleibt — das ist der Preis
  dafür, dass Namen sichtbar aus dem Topf verschwinden.
- Runden werden nicht automatisch gelöscht. Bei Bedarf manuell in Supabase.
