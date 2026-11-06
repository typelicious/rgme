# RGME v2.0 — AI-Native Retro Game Reconstruction & Reimagination Engine

**Status:** Strategisches Konzept / Architecture & Product Concept v2.0  
**Datum:** 06.11.2026  
**Kontext:** Weiterentwicklung der bisherigen RGME-Vision, PRD v0.2/v0.3, Rights-Audit-Batches 001–010 und Library Identity Registry.  
**Leitentscheidung:** RGME ist **keine primäre Emulatorentwicklung**, sondern eine evidenzbasierte Plattform zur Analyse, Rekonstruktion, Modernisierung und eigenständigen Neuinterpretation historischer Spiele.  
**Wichtiger Vorbehalt:** Dieses Dokument ist ein Konzept und keine abgeschlossene Rechtsprüfung. Frühere RGME-Artefakte wurden für diese Fassung nicht vollständig erneut eingelesen; referenzierte Registry- und Audit-Schemata sind als Integrationsvorgaben, nicht als verifizierte Bestandsbeschreibung zu verstehen.

---

## 1. Executive Summary

RGME v2 transformiert klassische Spiele nicht bloß technisch, sondern extrahiert — soweit rechtmäßig und technisch möglich — überprüfbare Informationen über Spielzustände, Regeln, Steuerung, Progression und Spielerfahrung. Daraus entstehen drei unterschiedliche Produktpfade:

1. **Preserve / Analyze:** autorisierte Originalsoftware in einer instrumentierten Referenzumgebung ausführen und dokumentieren.
2. **Modernize / Port:** bei hinreichenden Rechten ein bestehendes Spiel modernisieren, portieren, remastern oder neu implementieren.
3. **Reimagine / Inspired-by:** ein **eigenständiges neues Spiel** entwickeln, das von abstrakten Mechaniken oder einem Genre inspiriert ist, aber keine geschützte konkrete Ausdrucksgestaltung, Marken, Figuren, Texte, Grafiken, Musik, Karten oder spezifisch wiedererkennbare Gesamtgestaltung übernimmt.

Der dritte Pfad ist ein eigenständiger Produktmodus und **kein Trick zur Umgehung ungeklärter Rechte**. Eine Umbenennung oder Neuzeichnung eines faktischen Klons schafft keine automatische Rechtssicherheit. Technische Analyse von Originalsoftware ist zudem separat von der Verwertbarkeit ihrer Ergebnisse zu prüfen.

**Strategische These:** Der wichtigste Vermögenswert ist nicht ein Amiga-Emulator, sondern eine **Game Understanding & Transformation Pipeline** mit versionierten Evidenzen, abstrakten Regelmodellen, Test-Orakeln, Provenienz und rechtlichen Freigabegates.

## 2. Ziele, Nichtziele und Erfolgskriterien

### 2.1 Ziele
- Wiederholbare Untersuchung klassischer 2D-Spiele mit transparentem Herkunftsnachweis.
- Rekonstruktion beobachtbarer Spielregeln in einem strukturierten, engine-unabhängigen Modell.
- Erzeugung moderner spielbarer Prototypen auf Basis **freigegebener** Rechte oder **eigenständig formulierter** Spielkonzepte.
- Human-in-the-loop-Entscheidungen bei Recht, Design und Veröffentlichungen.
- Cross-platform-Ausführung, bevorzugt Desktop und Web.
- Automatisierte technische Validierung mit Trace- und Gameplay-Tests.
- Wiederverwendbare Pakete und standardisierte Projekt-Lifecycle-Steuerung.

### 2.2 Nichtziele für v2 MVP
- Kein eigener vollständig kompatibler Amiga-Emulator.
- Kein automatisches Freischalten geschützter Spiele oder DRM-Umgehen.
- Keine vollautomatische Zusage, ein generiertes Spiel sei IP-frei.
- Keine 1:1-Reproduktion geschützter Levels, Artworks oder Musik.
- Kein automatisches Massenscraping oder Veröffentlichen kommerzieller ROMs.
- Keine allgemeine Konvertierung beliebiger 68000-Binaries in wartbaren Rust-Code.

### 2.3 MVP-Definition
**Ein freies, selbst erstelltes oder ausdrücklich autorisiertes kleines Amiga-artiges Testspiel** wird instrumentiert analysiert. RGME erzeugt daraus ein überprüfbares Regel-/Zustandsmodell, erstellt eine eigenständige moderne Spielimplementierung und validiert definierte Spielmechaniken. Parallel wird für ein historisches kommerzielles Spiel ein **nicht-distributiver Rights/Concept-Assessment-Workflow** demonstriert, ohne geschützte Inhalte in den neuen Build zu übernehmen.

## 3. Drei Produktpfade und ihre Rechtsgates

| Pfad | Input | Output | Freigabevoraussetzung | Typische Monetarisierung |
|---|---|---|---|---|
| Preserve | Berechtigt verwendbare Images/Binaries | Analyse, Traces, dokumentierte Emulation | Nutzungs-/Analyseberechtigung und Asset-Provenienz | B2B Research, Preservation-Services |
| Modernize | Rechtegeklärtes Original | Port, Remaster, neue Engine | Explizite passende Lizenz/Erlaubnis | Publisher-Deal, Revenue Share, Auftrag |
| Reimagine | Abstrakte Designprinzipien, eigenständige Ideen | Neues Spiel, neue IP | Eigenständigkeitsprüfung, Trademark-/Design-/Copyright-Review | Eigene Titel, Indie-Publishing, Licensing |

**Entscheidungsregel:** Rechteproblem beim Original führt **nicht automatisch** zu Reimagine mit denselben Assets/Levels. Es führt zu einem neuen Designauftrag, der bewusst auf abstrakter Ebene ansetzt und eigenständige schöpferische Entscheidungen dokumentiert.

## 4. Referenzarchitektur

```text
                 Human Product / Legal / Creative Owners
                               |
                     GPT / Claude Controller
                               |
                    SkillWeave Lifecycle Gates
                               |
   +---------------------------+----------------------------+
   |                           |                            |
   v                           v                            v
Rights & Provenance      Research / Analysis          Game Design Studio
   |                           |                            |
Library Identity         REA + Ghidra                Concept Briefs
Rights Matrix            Emulator Instrumentation     Originality Constraints
License Evidence         Trace / Asset Observation    Human Design Decisions
   |                           |                            |
   +---------------------------+----------------------------+
                               |
                       Evidence / Source Policy
                               |
                      Game Knowledge Graph
                               |
                  Game Behavior IR / Rule DSL
                               |
                +--------------+---------------+
                |                              |
         Modernization Pipeline         Reimagination Pipeline
         (rights-cleared)               (new expression)
                |                              |
         Rust / Bevy / Godot            Rust / Bevy / Godot
                +--------------+---------------+
                               |
                      Validation & Review
                 Technical / Gameplay / IP / QA
                               |
                        Release Pipeline
```

### 4.1 Schichten
**A. Acquisition & Rights:** Quellen erfassen, Hashes, Eigentümer- und Lizenzbehauptungen mit Evidenzgrad dokumentieren, zulässige Nutzungszwecke begrenzen.

**B. Execution & Instrumentation:** vorhandene Emulatoren als externe Referenzumgebungen nutzen; kontrollierte Eingaben, Video/Audio-Capture, Memory-/Register-/Instruction-Traces, Save States. Keine Verpflichtung, Emulator-Code in RGME einzubetten.

**C. Reverse Engineering:** REA als agentengesteuerte Schnittstelle, Ghidra als statisches Analysebackend; Untersuchung nur bei geklärtem Analyse-Scope. Statische Befunde sind nicht mit gesichertem Spielverhalten gleichzusetzen.

**D. Semantic Reconstruction:** Extraktion von Entitäten, Zuständen, Aktionen, Ressourcen, Regeln, Zielen, Sieg-/Niederlagebedingungen, Progression und Timing. Jeder Befund erhält Quellen, Konfidenz und Reproduktionsanleitung.

**E. Transformation:** zwei getrennte Codegenerierungspfade mit unterschiedlichen Input-Policies. Für Inspired-by darf kein Quellcode, keine extrahierte Grafik und kein konkret nachgebauter Level als Generierungsgrundlage verwendet werden, wenn keine Rechte dafür bestehen.

**F. Validation:** Unit-, Property-, Metamorphic-, Gameplay- und Golden-Trace-Tests; unabhängiger Reviewer; juristisch-kreative Release-Freigabe.

### 4.2 Kern-Services / mögliche Repositories
- `rgme-core`: gemeinsame Typen, Konfiguration, Job-IDs, Artefaktmanifest.
- `rgme-library`: Game Identity Registry, Rights-Audit-Adapter, Hashing, Provenienz.
- `rgme-research`: REA/Ghidra-Orchestrierung, Findings, Evidence-Links.
- `rgme-emulator-adapters`: Adapter für Copperline und ggf. weitere Emulatoren.
- `rgme-behavior-ir`: Game Behavior Intermediate Representation, DSL, Schema-Validator.
- `rgme-gameplay-lab`: Input-Replay, State-Capture, Vergleich, Telemetrie.
- `rgme-transform`: Port-/Modernisierungs-Compiler und Generatoren.
- `rgme-reimagine`: Design-Constraint-Engine, Originalitätsprüfung, neue Game-Concepts.
- `rgme-runtime`: bevorzugt Rust + Bevy für experimentelle Runtime; Godot als pragmatische Alternative.
- `rgme-studio`: Web-/Desktop-Oberfläche, Review- und Freigabeflows.
- `rgme-skillweave-pack`: SkillWeave Workflows, Gates, Agents, Benchmarks.

**Shared Packages:** `research-core`, `evidence-core` und `source-policy` als bestehende organisatorische Zielbausteine berücksichtigen; `experiment-core` und `attribution-core` als nächste Integrationskandidaten. Keine doppelte Evidenz-Engine in RGME entwickeln.

## 5. Game Behavior IR (GBIR) — zentrale technische Innovation

Ein neutrales Regelmodell beschreibt **was das Spiel tut**, ohne zu behaupten, dass damit der gesamte Quellcode oder die schöpferische Ausdrucksform rekonstruiert sei.

### 5.1 Domänenmodell
- `Game`: Identität, Genre, Plattform, Provenienz, Rights-Scope.
- `Entity`: Spieler, Gegner, Objekte, Tiles, Inventargegenstände.
- `State`: diskrete Zustände und numerische Variablen.
- `Action`: Eingaben und KI-/Systemaktionen.
- `Transition`: Vorbedingungen, Auswirkungen, Priorität, Timing.
- `Resource`: Leben, Energie, Geld, Zeit, Munition, Rohstoffe.
- `World`: Topologie, Navigation, Zonen, ohne Übernahme geschützter Karten.
- `Objective`: Ziel, Fortschritt, Scheitern, Sieg.
- `Observation`: sicht-/hörbare Reaktionen und gemessene Traces.
- `Evidence`: Quelle, Zeitpunkt, Hash, Reproduktionsschritte, Confidence.
- `Constraint`: Lizenz-/Design-/Originalitätsbeschränkungen.

### 5.2 Beispiel: abstrakte Spielmechanik
```yaml
schema: rgme.gbir/v0.1
concept: resource-logistics-turn-based
entities:
  - id: player_company
    kind: organization
resources:
  - id: credits
    min: 0
  - id: fuel
    min: 0
actions:
  - id: dispatch_vehicle
    requires: [vehicle_available, route_accessible, sufficient_fuel]
    effects: [consume_fuel, advance_delivery]
objectives:
  - id: deliver_contracts
    condition: completed_contracts >= target_contracts
provenance:
  type: original_design
  reference_assets_included: false
```
Dieses Beispiel ist bewusst generisch; es enthält weder Originalnamen noch konkrete Level- oder Missionsstrukturen.

### 5.3 Konfidenzstufen
- **Observed:** wiederholbar im autorisierten Lauf beobachtet.
- **Derived:** logisch aus mehreren Beobachtungen abgeleitet.
- **Hypothesized:** plausible, noch nicht bestätigte Erklärung.
- **Specified:** bewusst neu gestaltete Regel; keine Behauptung über das Original.

Ein Generator darf `Hypothesized` nicht stillschweigend in `Observed` umetikettieren.

## 6. Technischer Reverse-Engineering-Flow

1. **Intake:** Software-Identität, Hash, Quelle, Berechtigungen, Untersuchungszweck.
2. **Rights Gate R0:** zulässige Analyseverfahren und Weiterverwendung bestimmen; ungeklärte Fälle in Quarantäne.
3. **Reference Environment:** Emulator-Version pinnen, Konfiguration, ROM-/Image-Herkunft, deterministische Inputs.
4. **Behavior Capture:** Screenshots, Zustandswechsel, Input-/Output-Sequenzen, Performance, optional CPU/Memory-Traces.
5. **Static Analysis:** REA/Ghidra auf autorisierten Binaries; Funktionen, Datenstrukturen und Kontrollfluss identifizieren.
6. **Evidence Fusion:** Befunde mit Laufzeitbeobachtungen abgleichen; Konflikte und Unknowns erhalten.
7. **GBIR Build:** maschinenlesbares Regelmodell und menschlich prüfbare Narrative erzeugen.
8. **Verification:** Gegenbeispiele und automatisierte Tests; getrennte Bewertung von Mechanik und ästhetischer Gestaltung.
9. **Branch Gate:** Modernize nur mit Rechten; Reimagine nur mit abstrahiertem, freigegebenem Designbrief.
10. **Implementation & QA:** neue Implementierung; Tests; Originalitäts- und Lizenzreview.

**Wichtig:** Eine aus dem Original extrahierte „saubere Spezifikation“ ist nicht automatisch frei nutzbar. Für den Reimagination-Pfad muss die Abstraktion bewusst auf ungeschützte Ideen/Prinzipien beschränkt werden.

## 7. Reimagination Engine — „Inspired by, not copied“

### 7.1 Leitidee
Historische Spiele als **Inspiration für Genres, Problemstellungen und abstrakte Interaktionsmuster** nutzen. Neue Spiele sollen eine eigenständige Identität besitzen und mehr sein als kosmetisch umbenannte Klone.

### 7.2 Design-Distanz-Matrix
| Dimension | Übernahme vermeiden | Zulässige Inspirationsrichtung (abhängig vom Einzelfall) |
|---|---|---|
| Titel/Marke | identische oder verwechslungsfähige Namen | eigenständiger Name und Markenprüfung |
| Charaktere/Story | Figuren, Dialoge, konkrete Handlung | neue Welt, Figuren und Erzählung |
| Grafik/UI | Sprites, Icons, Screens, prägende Bildkomposition | eigenes Art Direction System |
| Audio | Musik, Samples, Soundeffekte | neu komponierter Soundtrack |
| Level/Maps | konkrete Karten, Rätselabfolgen, Missionsstruktur | neue Topologien, Herausforderungen |
| Regeln | konkrete expressive Kombinationen möglichst nicht klonen | abstrakte Genre-/Mechanikprinzipien |
| Code/Daten | dekompilierter Code, Assets, Datentabellen | unabhängig implementierter Code |
| Marketing | „inoffizieller Nachfolger“, täuschende Nähe | eigene Positionierung ohne Herkunftsverwechslung |

### 7.3 Originality-by-Design Workflow
**Stage D0 — Inspiration Brief:** Nur Genre, gewünschtes Spielerlebnis, Zielgruppe, abstrakte Mechaniken, keine Originalassets.

**Stage D1 — Divergence Brief:** Mindestens mehrere substantielle neue Designachsen festlegen: Setting, Spielziel, Progression, Kernloop, Ressourcen, soziale Mechanik, Steuerung oder Levelstruktur. Die Zahl ist ein Prozessindikator, keine rechtliche Safe-Harbor-Schwelle.

**Stage D2 — Independent Concept:** Originales Game Design Document (GDD), Figurenbibel, visuelle Sprache, Mechanikgraph, neue Namenswelt.

**Stage D3 — Independent Build:** eigenständige Implementierung; für kritische Projekte Clean-Room-Trennung zwischen Research-Team und Design-/Build-Team.

**Stage D4 — Similarity Review:** manuelle Gesamtvergleichsprüfung plus technische Ähnlichkeitsindikatoren (Namen, Texte, Assets, Karten, UI). Automatische Scores können Risiken markieren, aber keine Rechtsfreiheit bescheinigen.

**Stage D5 — Legal/Brand Gate:** urheber-, marken-, design-, wettbewerbs- und vertragsrechtliche Prüfung; dokumentierte Freigabe.

### 7.4 Clean-Room-Option
- **Research Cell:** untersucht rechtmäßig zugängliche Originale; gibt nur freigegebene abstrakte Designbeobachtungen weiter.
- **Design Cell:** erhält keine Originalbinaries, dekompilierten Code, geschützten Assets oder detaillierten Levelkarten.
- **Review Cell:** prüft Output und dokumentiert Entscheidungen.
- Trennung ist eine Risikominimierung, **keine Garantie** gegen Rechtsverletzungen.

## 8. Beispielhafte Inspirationsfelder (keine Freigabe einzelner Originaltitel)

### 8.1 Taktische rundenbasierte Konflikte — inspiriert von einem Genre wie Battle Isle
**Neue Idee: „Tidal Frontiers“ (Arbeitstitel, Markencheck ausstehend).** Asymmetrische Expeditionsflotten auf dynamischen Archipel-Karten; Wetter, Versorgungsnetzwerke und Umweltfolgen statt historischer Fraktionen, Einheiten und Karten. Mechanik: taktische Züge, Ressourcen und Positionierung. Eigenständige Welt, Artstyle, Fraktionen und Siegbedingungen.

### 8.2 Wirtschafts-/Rohstoffsimulation — Genre-Nähe zu Oil Imperium
**Neue Idee: „Deep Current“ (Arbeitstitel).** Unterwasser-Infrastruktur, Kreislaufwirtschaft, Energiehandel und ökologische Risiken; neue Ereignislogik und moderne Multi-Agent-Märkte statt historischer Figuren, UI, Dialoge und Ereignisketten.

### 8.3 Humorvolles Point-and-Click-Adventure — Genre-Nähe zu Zak McKracken
**Neue Idee: „Signal & Static“ (Arbeitstitel).** Eigenständiges Mystery-Abenteuer über eine interplanetare Radiostation, Medienarchäologie und kollaborative Rätsel. Kein Übernehmen von Charakteren, konkreten Gags, Storybeats, Locations, Puzzlelösungen oder visueller Identität.

**Wichtig:** Diese Titel sind lediglich kreative Arbeitshypothesen, weder markenrechtlich geprüft noch automatisch rechtlich unbedenklich. Eine erkennbare Nähe zum Original kann auch ohne 1:1-Assets problematisch sein.

## 9. Rechtliche Einordnung (Deutschland/EU; keine Rechtsberatung)

### 9.1 Grundsatz
Nach § 69a Abs. 2 UrhG sind Ideen und Grundsätze, die einem Element eines Computerprogramms zugrunde liegen, als solche nicht geschützt; geschützt sind Ausdrucksformen des Programms. Das bedeutet **nicht**, dass alle anderen Bestandteile eines Videospiels frei übernommen werden dürfen. Grafiken, Musik, Texte, audiovisuelle Gestaltung, Figuren oder konkrete kreative Kombinationen können eigenständigen Schutz genießen.

### 9.2 Separate Rechtsfragen
1. **Analysezugang:** Darf die konkrete Kopie erworben, geladen und untersucht werden? Welche Nutzungsbedingungen gelten?
2. **Dekompilierung:** § 69e UrhG hat eng umrissene Voraussetzungen, insbesondere zur Interoperabilität; keine allgemeine Freigabe für beliebige Remakes. § 69d und § 69g sind ebenfalls zu prüfen.
3. **Urheberrecht:** Eigenständige Ausdrucksformen von Code, Grafik, Musik, Story, Figuren, Levels.
4. **Markenrecht:** Namen, Logos, Verwechslungsgefahr, Werbeaussagen.
5. **Design-/Wettbewerbsrecht:** Produktaufmachung, unlautere Nachahmung, Herkunftstäuschung.
6. **Verträge:** EULA, Publisher- und Vertriebsverträge, Lizenzketten.
7. **KI-Outputs:** mögliche Reproduktion geschützter Elemente; Nutzungsrechte an generierten Assets, Trainings- und Input-Policies.

### 9.3 Rechte-Entscheidungsbaum
```text
Gibt es ausreichende Rechte für Port/Remaster?
  YES -> Modernize-Lane + Asset/Code-Lizenzcheck
  NO / UNKNOWN -> Keine Modernize-Freigabe
                   |
              Eigenständiges neues Spiel gewünscht?
                   |
                   YES -> Abstrakter Inspiration Brief
                          -> Independent Design
                          -> Similarity + Brand + Legal Review
                          -> Release nur nach Freigabe
```

**Keine falschen Regeln:** Weder „20 % ändern“ noch „neue Grafik + neuer Name“ oder „Mechaniken sind immer frei“ sind zuverlässige rechtliche Freigabekriterien. Ebenso ist „Abandonware“ kein eigenständiger gesetzlicher Lizenzstatus.

### 9.4 Evidence- und Rights-Registry
Pro Spiel getrennt speichern: `original_work_id`, `edition_id`, `binary_hash`, `source`, `rights_claim`, `rights_holder_candidates`, `license_evidence`, `analysis_permission`, `distribution_permission`, `derivative_work_permission`, `trademark_risk`, `review_status`, `last_reviewed`, `legal_notes`, `provenance_links`.

## 10. SkillWeave-Agentenorganisation

| Rolle | Verantwortlichkeit | Abnahme |
|---|---|---|
| Product Controller (GPT/Claude) | Zielzerlegung, Budget, Gates, Eskalationen | Human Owner |
| Rights Research Agent | Rechtekette, Quellen, Unsicherheiten | Legal Reviewer |
| Emulator Adapter Agent | Instrumentierung, Replay, Traces | Integration Tests |
| REA/Ghidra Agent | Statische Analyse, Befundprotokolle | Evidence Reviewer |
| Behavior Modeling Agent | GBIR und Hypothesen | Independent QA |
| Game Design Agent | Originalkonzepte, GDD | Creative Director |
| Rust/Engine Agent | Implementation | CI + Code Review |
| Similarity Review Agent | Ähnlichkeitsindikatoren | Human Legal/Creative Gate |
| Validation Agent | Testorakel, Regressionssuite | Unabhängige Testinstanz |

**Controller-Strategie:** GPT und Claude gegeneinander benchmarken; nicht vorab ein dauerhaftes Sieger-Modell behaupten. SkillWeave steuert Aufgabengrenzen, Evidence Receipts, Reviewer-Separation und Abbruchbedingungen. Ein separater Budget Controller erfasst Token-, Laufzeit- und menschliche Review-Kosten.

### 10.1 Lifecycle-State-Machine
`INTAKE -> RIGHTS_TRIAGE -> RESEARCH_AUTHORIZED -> CAPTURE -> MODEL -> VERIFIED -> {MODERNIZE|REIMAGINE} -> BUILD -> QA -> IP_REVIEW -> RELEASED`

Zusätzliche Zustände: `BLOCKED_RIGHTS`, `NEEDS_EVIDENCE`, `REWORK`, `REJECTED`, `ARCHIVED`. Kein automatischer Übergang über Rechte- oder IP-Gates.

## 11. Technologiewahl und Lizenzstrategie

### 11.1 Emulator
**Copperline** ist eine ernstzunehmende Rust-Referenz (OCS/ECS/AGA, Debugging, Headless, JSON-RPC/MCP laut README), aber unter **GPL-3.0-or-later**. Erst evaluieren, dann entscheiden, ob Prozessisolation, reine Toolnutzung oder eine andere Lösung architektonisch und rechtlich passt. Prozessgrenzen allein garantieren keine lizenzrechtliche Trennung. Keine Übernahme von GPL-Code in einen inkompatibel lizenzierten proprietären Kern.

### 11.2 Reverse Engineering
**REA**: MIT für REA-eigenen Code, separate Bedingungen für Drittwerkzeuge; Node- und Provider-Versionen pinnen. **Ghidra**: Apache-2.0; Java/Headless-Anforderungen und Motorola-68k-Unterstützung im Spike prüfen. Beide ausschließlich mit zulässigen Inputs einsetzen.

### 11.3 Runtime
- **Rust:** für GBIR, Trace-Parser, Replay, Simulation, Datenverarbeitung und ggf. Bevy-Runtime.
- **Bevy:** Kandidat für rein Rust-basierte 2D-Game-Engine und ECS-Workflows.
- **Godot:** Alternative für schnellere spielbare Prototypen, Editor-Workflows und Content-Teams.
- **Web UI:** TypeScript-basierte Studio-Oberfläche; REST/gRPC/JSON-RPC abhängig vom tatsächlichen Deployment.
- **PostgreSQL:** Metadaten, Provenienz und Status; Objektstore für Binaries, Traces, Videos, Artefakte.

**Entscheidung:** Rust-first für Plattformkern, **engine-agnostische GBIR** für die Spielausgabe. Nicht die gesamte Produktstrategie an Bevy oder Godot binden.

## 12. Datenmodell und API-Skizze

### 12.1 Tabellen
`works`, `editions`, `source_artifacts`, `rights_assertions`, `analysis_authorizations`, `research_sessions`, `observations`, `evidence_links`, `behavior_models`, `design_briefs`, `transformation_jobs`, `similarity_findings`, `review_decisions`, `build_artifacts`, `test_runs`.

Jede Entität: unveränderliche IDs, Zeitstempel, Version, Autor/Agent, Input-Hashes, Modell-/Tool-Version und Policy-Version. Evidence ist append-only; Korrekturen als neue Revision.

### 12.2 Beispiel-Endpunkte (Entwurf)
```http
POST /v1/works
POST /v1/works/{id}/rights-assessments
POST /v1/research-sessions
POST /v1/research-sessions/{id}/captures
POST /v1/behavior-models/compile
POST /v1/design-briefs
POST /v1/transformation-jobs
POST /v1/reviews/{id}/decisions
GET  /v1/jobs/{id}/evidence
```

### 12.3 Artefaktverzeichnis
```text
projects/<project-id>/
  manifest.yaml
  rights/
  sources/              # access-controlled, never public by default
  research/
  observations/
  behavior-ir/
  design/
  builds/
  validation/
  release/
```

## 13. Validation Framework

**Technical correctness:** Emulator-Start, Replay-Determinismus (soweit erreichbar), Parser-Tests, GBIR-Schema, State-Transition-Tests, Regression.

**Behavior fidelity:** Für autorisierte Modernisierungen Vergleich von definierten Zustandsübergängen und Gameplay-Szenarien; Pixelgleichheit ist nicht immer sinnvoll.

**Reimagination quality:** neue Spielidentität, kohärenter Kernloop, Spaß-/Usability-Tests, Accessibility, Performance, keine unbeabsichtigten Ähnlichkeiten.

**IP review:** getrennte Prüfung von Code, Text, Art, Audio, Marken, Karten, Figuren und Gesamtanmutung. Technische Ähnlichkeitsmessung ist nur ein Screening.

**Agent evaluation:** Aufgabenabschlussquote, Rework-Rate, Evidence-Coverage, Kosten pro akzeptiertem Change, menschliche Minuten pro Gate, Testflakiness.

## 14. MVP-Roadmap und realistische Aufwandshypothesen

| Phase | Dauer als Planungsziel | Liefergegenstand | Exit Gate |
|---|---|---|---|
| 0. Discovery | 3–5 Arbeitstage | Repo-/Lizenz-/Rechtecheck, Architekturspike | Go/No-Go |
| 1. Foundation | 1–2 Wochen | Registry-Adapter, Evidence, SkillWeave-Workflow | Reproduzierbarer Run |
| 2. Observation Lab | 1–3 Wochen | Emulatoradapter, Input-Replay, Capture, REA/Ghidra-PoC | Wiederholbare Beobachtung |
| 3. GBIR | 1–2 Wochen | Schema, Compiler, manuell verifiziertes Regelmodell | Schema- und Gameplay-Tests |
| 4. Reimagine Prototype | 2–4 Wochen | Neues kleines 2D-Spiel, neue Assets | Spielbar + Review |
| 5. Pilot | 2–4 Wochen | Zwei Fallstudien, Kosten-/Qualitätsreport | Produktentscheidung |

**Gesamt:** etwa 7–15 Wochen für einen eng gefassten, betreuten Pilot als *unverbindliche Hypothese*. Parallelisierung ist möglich, aber der kritische Pfad wird von Rechten, Beobachtbarkeit, GBIR-Qualität und Spiel-Design bestimmt. Ein einfacher eigenständiger Inspired-by-Prototyp ohne Binary-Analyse kann deutlich früher vorliegen. Eine universelle vollautomatische Game-Reconstruction-Engine ist damit nicht erreicht.

### 14.1 Erster 10-Tage-Spike
- Tag 1–2: Copperline-API/Headless/MCP und Lizenzgrenzen validieren; Test-Assets mit eindeutiger Erlaubnis wählen.
- Tag 3–4: Replay und Capture reproduzierbar machen; Input-/Output-Evidence speichern.
- Tag 5–6: REA/Ghidra-Pipeline für autorisiertes 68k-Testbinary; Befunde mit Evidenzgrad.
- Tag 7: GBIR-Minimalschema und drei Regeln modellieren.
- Tag 8–9: Eigenständigen Rust-/Godot-Miniprototyp bauen und Testfälle ausführen.
- Tag 10: Ergebnisbericht, Kosten, Grenzen, Entscheidung Bevy vs Godot und Copperline-Adapter.

## 15. Produktstrategie und Monetarisierung

### 15.1 Zielgruppen
- Indie-Studios, die klassische Genres neu interpretieren möchten.
- Rechteinhaber und Publisher mit Legacy-Katalogen.
- Preservation- und Forschungsprojekte.
- Studios mit Bedarf an Game-Behavior-Analyse und automatisierter Regression.

### 15.2 Angebote
1. **RGME Research Studio:** Tooling für zulässige Analyse und dokumentierte Regelmodelle.
2. **RGME Modernize Services:** Auftragsportierung/Remaster mit Rechteinhabern.
3. **RGME Reimagine Studio:** interne Produktion eigenständiger Spiele.
4. **RGME SDK:** GBIR, Replay, Validation und Evidence als Developer-Pakete.

### 15.3 Kommerzielle Leitplanken
- Keine ungesicherten „legal clone“-Versprechen.
- Keine fremden ROMs oder Assets in Demos/Marketing.
- Kostenpflichtige Originalitäts- und Rechteprüfung vor kommerziellem Release.
- Plattformkern und GPL-Komponenten lizenzstrategisch sauber trennen; gegebenenfalls alternative Emulatoren prüfen.
- Pro Spiel eine dokumentierte Build-/Asset-Provenienz.

## 16. Risiko-Register

| Risiko | Schwere | Maßnahme |
|---|---|---|
| Unklare Rechte an Originalsoftware | kritisch | Rights Gate, Quarantäne, Legal Review |
| Zu große Ähnlichkeit einer Neuinterpretation | kritisch | Divergence Brief, Clean Room, Similarity Review |
| GPL-/Dependency-Konflikt | hoch | SBOM, Lizenzscan, Architektur-/Rechtsprüfung |
| Halluzinierte Reverse-Engineering-Befunde | hoch | Evidence-Links, Reproduktion, unabhängige Validierung |
| Nichtdeterministische Emulatorläufe | hoch | Version Pinning, Capture-Protokolle, Toleranzfenster |
| Fehlinterpretation von Spielregeln | hoch | Gegenbeispiele, Spieler-Review, Hypothesenstatus |
| Zu frühe Automatisierung | mittel/hoch | zuerst Human-in-the-loop MVP |
| Tool-/Modellkosten | mittel | Budget-Gates, Quotas, Tracing |
| Unklare Publisher-Rechteketten | hoch | Rights Registry, mehrere Belege, externe Prüfung |
| Scope Creep | hoch | ein Spielgenre, ein Referenzspiel, ein Engine-Target |

## 17. KPIs und Go/No-Go

**Research:** Anteil reproduzierbarer Observations; Evidence Coverage; Anteil offener Hypothesen.  
**Engineering:** Medianzeit von Brief bis spielbarem Build; Testpassrate; Rework; Kosten/Change.  
**Creative:** Originalitätsreview, Spieltestfeedback, D1-/D7-Retention in späteren Piloten.  
**Legal:** Anteil vollständig dokumentierter Rechteentscheidungen; 0 ungeprüfte fremde Assets im Release.  
**Commercial:** Prototypkosten, Aufwand pro Studioauftrag, Conversion von Pilot zu Lizenz-/Auftragsgeschäft.

**Go**, wenn ein kleiner End-to-End-Flow reproduzierbar läuft, die neue Spielidentität erkennbar eigenständig ist und die Reviewkosten vertretbar sind. **No-Go/Pivot**, wenn Analyse nicht zuverlässig zu GBIR führt, Lizenzgrenzen unlösbar sind oder der Inspired-by-Pfad praktisch nur Klone erzeugt.

## 18. Entscheidungsbedarf

1. **RGME v2 als Game Understanding & Reimagination Platform bestätigen** (statt Emulator-Produkt).
2. **Rust-first + GBIR engine-agnostisch** als Architekturprinzip festlegen.
3. **Copperline nur als zu evaluierende Referenz-/Tool-Komponente** einstufen, keine vorzeitige Fork-Entscheidung.
4. **Rights-Audit/Identity Registry** als verpflichtenden Intake integrieren.
5. **Reimagine als separaten kreativen und rechtlichen Workflow** definieren.
6. **MVP-Testtitel:** vorzugsweise eigens erstelltes, kleines 68k-Spiel mit freigegebenem Code und Assets.
7. **Erste kommerzielle Inspirationsrichtung:** taktische Strategie, Wirtschafts-/Logistiksimulation oder Point-and-Click anhand von Markt- und Machbarkeitskriterien priorisieren.

## 19. Konkrete nächste Artefakte

- `RGME-v2-Technical-Architecture-v0.1.md` — Komponenten, Interfaces, Deployment, Security, Lizenzgrenzen.
- `RGME-GBIR-Schema-v0.1.json` — JSON Schema plus Beispielmodelle.
- `RGME-SkillWeave-Agent-Pack-v0.1.md` — Rollen, Tasks, Evidence Receipts, Gates, Benchmarks.
- `RGME-Reimagination-IP-Policy-v0.1.md` — Design Distancing, Clean Room, Review-Checklisten.
- `RGME-10-Day-Spike-Plan-v0.1.md` — ausführbare Tasks, Akzeptanzkriterien, Aufwandserfassung.
- `RGME-Library-Registry-Integration-v0.1.md` — Mapping der bisherigen Rights-Batches und Identity Registry.

## 20. Quellen und Verifikationshinweise

- SkillWeave: https://github.com/SkillWeave-AI/skillweave — Version und konkrete Interfaces vor Implementierung anhand des aktuellen Repos verifizieren.
- REA: https://github.com/morluto/rea — MCP, CLI, lokale Analyse, MIT für REA-eigenen Code; Drittanbieterbedingungen separat.
- Ghidra: https://github.com/NationalSecurityAgency/ghidra — Reverse-Engineering-Framework, Apache-2.0.
- Copperline: https://github.com/CopperlineHQ/Copperline — Rust-Amiga-Emulator, GPL-3.0-or-later, laut README Headless-/Debug-/MCP-Funktionen.
- § 69a UrhG: https://www.gesetze-im-internet.de/urhg/__69a.html
- § 69d UrhG: https://www.gesetze-im-internet.de/urhg/__69d.html
- § 69e UrhG: https://www.gesetze-im-internet.de/urhg/__69e.html
- § 69g UrhG: https://www.gesetze-im-internet.de/urhg/__69g.html

**Research status:** Öffentliche Projektinformationen und § 69a UrhG wurden für diese Konzeptfassung punktuell geprüft. Eine vollständige aktuelle Due Diligence zu allen Dependencies, Rechtsfragen, früheren RGME-Dokumenten und Marktpotenzialen steht noch aus.

---

**Kernsatz:** RGME v2 macht aus historischen Spielen nicht automatisch neue Kopien, sondern entwickelt eine kontrollierte Pipeline von rechtmäßig gewonnenem Wissen über Spielverhalten zu **eigenständigen, modernen Spielerlebnissen**.
