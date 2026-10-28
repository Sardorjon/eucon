# Veranstaltungsverwaltung

Web-Anwendung für das Corporate-Marketing-Team: über 5.000 Veranstaltungen überblicken, filtern, auswerten, pflegen und exportieren.

**Angular 22** (Standalone, zoneless, Signals) · **DevExtreme 26.1** · **ExcelJS** · **Vitest**

> Es gibt **kein echtes Backend**. Ein simuliertes Repository verhält sich wie eine API: Paging, Sortierung und Filterung laufen „serverseitig“, mit 100–300 ms Latenz und ca. 5 % Fehlerquote.

## Setup

```bash
npm ci
npm start            # Dev-Server: http://localhost:4100
npm test             # Unit-Tests (Vitest), einmalig
npm run test:watch   # Unit-Tests im Watch-Modus
npm run lint         # ESLint (angular-eslint, inkl. Template-Accessibility-Regeln)
npm run lint:fix     # automatisch behebbare Lint-Fehler korrigieren
npm run build        # Produktions-Build nach dist/
npm run watch        # Entwicklungs-Build im Watch-Modus
npm run check        # lint + test + build (z. B. vor einem Push / in CI)
```

Voraussetzung: Node 22+. Ohne DevExtreme-Lizenzschlüssel erscheint ein Evaluierungsbanner (siehe [Einschränkungen](#was-sie-nicht-kann)).

## Was die Anwendung kann

| Bedarf                       | Umsetzung                                                                                                                                                                                                             |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Überblick über 5.000+ Events | DataGrid mit Remote-Paging (25/50/100, Standard 50): Datum, Ort, Status, Teilnehmerzahl                                                                                                                               |
| Schnell finden               | Freitextsuche über alle Spalten (Name, Ort, Status; Datum und Teilnehmerzahl bei exakter Eingabe, z. B. `04.11.2026` oder `7`), Header-Filter für Status/Ort, Zeitraum („zwischen“) im Filter-Row, Mehrfachsortierung |
| Einstellungen bleiben        | Filter, Suche, Sortierung und Seitengröße werden versioniert und validiert im `localStorage` gespeichert                                                                                                              |
| Auswerten                    | Teilnehmersummen nach Status oder Ort über **alle Treffer des aktiven Filters**, nicht nur über die sichtbare Seite                                                                                                   |
| Anlegen                      | Dialog mit Pflichtfeldern; das Datum muss **ab morgen** liegen (Client und „Server“ prüfen); kein Doppel-Submit                                                                                                       |
| Status/Ort ändern            | Inline in der Zelle; bei Fehler Rollback und Meldung                                                                                                                                                                  |
| Status aus dem Backend       | Werden geladen (`getStatuses()`), nicht im Code fest verdrahtet                                                                                                                                                       |
| Teilnehmer                   | Aufklappbare Zeile, **lädt erst beim Öffnen**; hinzufügen/entfernen (Name, E-Mail, Rolle); die Teilnehmerzahl der Zeile wird per `store.push` aktualisiert, ohne Neuladen der Liste                                   |
| Export                       | Excel mit Veranstaltungsname und Exportdatum im Kopf, deutschem Datumsformat (`TT.MM.JJJJ`) und **allen** Treffern der aktuellen Sicht (Filter, Suche, Sortierung)                                                    |
| Fehler & Zustände            | Lade-, Leer- und Fehlerzustände; Lesezugriffe werden 2× automatisch wiederholt, Schreibzugriffe nie                                                                                                                   |
| Sprache                      | Alle Texte zentral in `de.json`; weitere Sprachen ohne Umbau ergänzbar (siehe unten)                                                                                                                                  |

## Architektur

```
src/
  styles/            _tokens.scss (Farben/Abstände, aliasiert DevExtreme --dx-*), _utilities.scss (mb-2, d-flex, gap-3 …)
  app/
    core/            i18n (Texte in de.json), NotifyService, globaler ErrorHandler
    shared/
      data/          ListQuery-Vertrag, AppError, Query-Engine (ListQuery → DevExtreme `query()`), MockBackend (Latenz/Fehler), Read-Retry
      data-grid/     createRemoteStore, LoadOptions→ListQuery-Mapper, Grid-State-Storage, Excel-Export
      ui/            ErrorAlert (Fehler + „Erneut versuchen“)
      utils/         Datum (ISO ↔ deutsch), sicherer localStorage-Zugriff
    features/events/
      domain/        Typen: EventItem, EventStatus, Participant, Summary, Inputs
      data-access/   EventsRepository (Interface + Token), MockEventsRepository, Seed
      events-page/, event-summary/, event-create-popup/, event-participants/, status-badge/
```

**Importe:** Jedes Modul hat eine Barrel-Datei (`index.ts`) als öffentliche API. Modulübergreifend wird nur über Pfad-Aliase importiert: `@core`, `@shared/data`, `@shared/data-grid`, `@shared/ui`, `@shared/utils`, `@features/events/domain`, `@features/events/data-access`. Innerhalb eines Moduls bleiben die Importe relativ, so entstehen keine Zyklen über das eigene Barrel.

**Datenfluss:** DataGrid → `createRemoteStore` → `toListQuery()` (Whitelist) → `EventsRepository` → Mock (filtern → sortieren → zählen → pagen).
DevExtreme-Typen enden in `shared/data-grid`. Domain und Repository kennen nur `ListQuery` / `PagedResult`.

## Entscheidungen

1. **Das Grid besitzt den Listen-State, nicht ein eigener Store.**
   _Alternativen:_ Signal-Store mit Query/Seite/Items/Loading; NgRx.
   _Begründung:_ DevExtremes `CustomStore` verwaltet Paging, Sortierung, Filter, Laden und das Verwerfen veralteter Antworten bereits (es bricht abgelöste Requests über ihre `operationId` ab). Eine Kopie in Signals hieße zwei Wahrheiten. Signals halten nur, was das Grid nicht besitzt: Lookups, den aktiven Filter für die Auswertung und UI-Flags. Die Auswertung nutzt `rxResource`, so werden veraltete Requests automatisch abgebrochen.

2. **Generische Grenze `LoadOptions → ListQuery → Repository`.**
   _Alternativen:_ eventspezifische `EventQuery` (statusIds, locationIds …); DevExtreme-Optionen direkt ans Repository geben.
   _Begründung:_ Ein Mapper und eine Query-Engine bedienen jede künftige Liste. Der Mapper erlaubt nur freigegebene Felder und Operatoren, begrenzt Tiefe und `take` und wandelt `Date` in lokale ISO-Daten um. Manipulierter oder veralteter gespeicherter Zustand kann so keine beliebigen Abfragen erzeugen. `ListQuery` lässt sich 1:1 auf Query-Parameter oder OData abbilden. Im Mock wertet DevExtremes Array-`query()` (mit deutscher Collation) die Abfrage aus. Es gibt also keine eigene Filter- oder Sortierlogik, und der Vertrag bleibt trotzdem DevExtreme-frei.

3. **Grid-native Filter und Persistenz** (Search-Panel, Header-Filter, Filter-Row, `stateStoring`).
   _Alternativen:_ eigene Filterleiste plus eigene `localStorage`-Synchronisation; URL-Parameter.
   _Begründung:_ am wenigsten Code und für jede Liste gleich bedienbar. Gespeichert wird ein versioniertes Format (`events-grid:v1`), beim Laden und Speichern auf eine Whitelist reduziert, ohne Seitenindex und ohne Daten.

4. **Export über DevExtreme `exportDataGrid` + ExcelJS.**
   _Alternativen:_ CSV (keine Kopfzeilen und Excel-Datumsprobleme); Export im Backend.
   _Begründung:_ `exportDataGrid` lädt alle Treffer der aktuellen Sicht über denselben Store und dieselbe Query-Semantik. ExcelJS wird erst beim Klick geladen (eigener Lazy-Chunk). `encodeExecutableContent` verhindert Formel-Injection, denn die Dateien gehen auch an Externe.

5. **Styling: Design-Tokens + Utility-Klassen statt Tailwind.**
   _Alternativen:_ Tailwind; SCSS pro Komponente.
   _Begründung:_ Tailwind 4 unterstützt kein Sass, und sein Preflight kollidiert mit DevExtreme. Unsere Tokens aliasieren DevExtremes `--dx-*`-Variablen, damit es eine Quelle der Wahrheit gibt. Komponenten haben nur dann eigene Styles, wenn sie wirklich einzigartig sind.

6. **i18n über DevExtremes Message-Registry.**
   _Alternative:_ Angular `$localize` (ein Build pro Sprache) oder eine Zusatzbibliothek.
   _Begründung:_ Ein Mechanismus übersetzt App-Texte **und** DevExtreme-Widgets (Pager, Filter, Dialoge). Weitere Sprachen werden gegen die deutschen Schlüssel typisiert, fehlende Übersetzungen brechen also den Build. Backend-Fehler liefern Schlüssel statt Text.

## Annahmen

- **„Datum in der Zukunft“** heißt ab morgen, als lokaler Kalendertag ohne Uhrzeit.
- **„Aktuelle Sicht“ beim Export** heißt alle Treffer von Filter, Suche und Sortierung, mit den sichtbaren Spalten. Die Teilnehmerlisten sind nicht enthalten.
- **„Veranstaltungsname und Exportdatum im Kopf“:** Der Kopf des Exports enthält den Titel „Veranstaltungen“ und das Exportdatum. Da alle Veranstaltungen exportiert werden, steht der Veranstaltungsname je Zeile in der Spalte „Name“.
- **Die Auswertung** bezieht sich auf alle Treffer des aktiven Filters inklusive Suche.
- **Statusfarben** sind optionale Backend-Daten. Der Status wird immer als Text angezeigt, die Farbe ist nur ein Punkt.
- **Teilnehmerrollen** (Gast, Referent/in, Organisation, Presse) sind vorerst fest im Frontend, als Schlüssel.
- **Daten werden als `YYYY-MM-DD`** übertragen, ohne Zeitzone.

## Performance: wie und wie geprüft

**Wie:**

- Es werden nie alle Daten ins Grid geladen. Remote-Paging rendert höchstens 100 Zeilen.
- Sortieren, Filtern und Zählen passieren im (simulierten) Backend.
- Die Suche wartet 700 ms nach der letzten Eingabe (Standardverhalten von DevExtreme).
- Teilnehmer werden erst beim Aufklappen geladen.
- Feature und ExcelJS sind Lazy-Chunks.

**Geprüft** (Headless-Chrome gegen `ng serve`, 5.000 Events):

- Der Start lädt `getStatuses`, `getLocations`, `getEvents` und `getSummary`, je **genau einmal**.
- **50** Zeilen sind im DOM; der Pager zeigt „Seite 1 von 100 (5000 Einträge)“.
- Mock-Requests sind im Dev-Modus in der Konsole sichtbar (`[mock] getEvents 182ms`). So lässt sich pro Aktion nachvollziehen, dass nur eine Seite übertragen wird.

**Bundle (Produktion):**

- Initial: **380 kB** Transfer (2,28 MB roh).
- Events-Seite: 392 kB.
- ExcelJS: 218 kB, wird nur beim Export geladen.

## Tests

`npm test` führt **56 Tests** aus. Sie decken die Logik ab, in der Fehler teuer und Tests billig sind:

- **Query-Engine:** filtern → sortieren → zählen → pagen; Umlaute und Groß-/Kleinschreibung (Suche und deutsche Sortierung); Seite jenseits des Endes; unbekannte IDs
- **LoadOptions-Mapper:** Header-Filter-, Zeitraum- und Suchausdrücke; Whitelist; Zeitzone bei `Date`-Werten
- **Mock-Repository:** 5.000 Events mit 3–10 Teilnehmern, Determinismus, konsistente Teilnehmerzahl, Summen = Summe der gefilterten Menge, Validierung, erzwungene Fehler
- **MockBackend und Retry:** Latenz, Fehlerquote, Klonen, kein Retry bei 4xx
- **Grid-State-Storage:** kaputtes JSON, falsche Version, Whitelist, kein oder voller Speicher
- **Remote-Store:** Mapping, Retry nur beim Lesen
- **Export:** Kopfzeilen, Excel-Datumsformat, sichere Optionen, kein Download bei Fehler
- **Datum:** Zukunftsregel, Formatierung
- **i18n:** verschachteltes JSON → flache Schlüssel, Platzhalter, Fallback für unbekannte Schlüssel

Bewusst ausgelassen sind Komponenten- und E2E-Tests der DevExtreme-Widgets. Sie würden vor allem die Bibliothek testen und kosten viel Zeit. Der Ablauf wurde manuell bzw. headless geprüft.

## Was sie nicht kann

- **Kein HTTP-Repository und keine Authentifizierung.** Die Daten liegen im Speicher und sind nach einem Neuladen zurückgesetzt.
- **Ohne DevExtreme-Lizenzschlüssel** erscheinen Evaluierungsbanner und Konsolenwarnung.
- **Name und Datum** sind nach dem Anlegen nicht änderbar. Events können nicht gelöscht werden.
- **Nur Deutsch.** Weitere Sprachen sind vorbereitet, aber nicht enthalten. Ein Sprachwechsel würde die Seite neu laden, weil DevExtreme die Locale nicht zur Laufzeit wechselt. Statuslabels müsste ein echtes Backend per `Accept-Language` lokalisieren.
- **Der Export lädt alle Treffer in den Browser**, bei 5.000 Zeilen kein Problem. Für sehr große Mengen gehört er ins Backend.
- **Keine URL-Synchronisation** der Filter (teilbare Links). Kein Dark Mode, obwohl die Tokens ihn vorbereiten.

## Wie sie skaliert

- **Neue Bereiche** (Veranstaltungsorte, Rechnungen …):
  1. Repository-Interface und Token anlegen.
  2. `createRemoteStore({ fields, load })` mit einer Feld-Whitelist aufrufen.
  3. Spalten im Template definieren.

  Paging, Filter, Persistenz (`[stateStoring]="gridStateStoring('invoices-grid', 1)"`), Fehlerbehandlung und Excel-Export (`exportGridToExcel(grid, { title, fileName })`) werden wiederverwendet. Neu erfunden wird nichts.

- **Echtes Backend:** Den Provider in `events.routes.ts` durch eine `HttpClient`-Implementierung ersetzen. `ListQuery` wird zu Query-Parametern, `BackendError` zu HTTP-Status plus Message-Key. Komponenten bleiben unverändert.
- **Mehr Daten:** Das Frontend rendert unabhängig von der Gesamtmenge immer eine Seite. Die Skalierung liegt im Backend (Indizes auf Filter- und Sortierfelder), beim Export ggf. ein serverseitiger Excel-Job.
- **Neue Sprache:** eine `<lang>.json` mit denselben Schlüsseln plus ein Eintrag in `LOCALES` (`i18n.ts`); der Sprachumschalter im Kopf erscheint automatisch ab zwei Sprachen.
- **Neuer Status:** reine Backend-Daten; das Frontend braucht keine Änderung.
- **Theme:** DevExtreme-Theme tauschen oder Tokens ändern; Komponenten enthalten keine Rohfarben.

## Mit mehr Zeit

- HTTP-Repository mit Contract-Tests gegen dieselbe Spezifikation wie der Mock
- E2E-Tests (Playwright) für den Hauptablauf: suchen, anlegen, inline ändern, Teilnehmer, Export
- Performance-Profiling dokumentieren; Stresstest mit 50.000+ Events
- Serverseitiger Export für sehr große Mengen
- Filter in der URL für teilbare Ansichten
- Optimistische Updates bei Teilnehmern; Rollen aus dem Backend
- Dark Mode über die vorhandenen Tokens
