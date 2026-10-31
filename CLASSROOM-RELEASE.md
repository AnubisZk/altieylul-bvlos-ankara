# Classroom update — 2026-10-03

Approved student suggestions: guide corrections, reset flight, vertical speed, waypoint feedback, gradual turns, side-dome investigation, expanded map, named plans and adjustable wind.

Implemented:
- Reset confirmation clears flight/assessment and restores launch readiness while preserving the selected route and stored plans.
- Signed vertical speed beside ground speed; bounded autopilot yaw, approach deceleration and gentler manual yaw. Manual flight uses 1x simulation time.
- Completed map markers and route rows change color; camera notice and flight log identify completed points.
- Expanded map retains Leaflet navigation and route editing; Escape closes it. Default dashboard organization retained.
- Named browser-local plans (30 max), non-destructive legacy migration, duplicate-name protection; three example routes.
- Wind speed 0–12 m/s and direction FROM 0–315°; simplified headwind, manual drift and energy effects, model bank and windsock response.
- Current guide replaces unsupported menu/features claims; battery is remaining percentage. Twenty matching Turkish female narration clips regenerated.
- Four mosque lead roof meshes contained inward-wound side-dome strips. Corrected 516 Sultanahmet, 220 Ayasofya, 240 Süleymaniye and 408 Yeni Cami triangles on load. UVs and colors preserved; unrelated meshes untouched. Actual downloaded Draco meshes were inspected and the repair checked for idempotence.

Validation:
- Standard: 37 passing Node tests. XR: 40 passing Node tests. Production builds and git diff checks passed.
- Browser: map expand/edit/add/undo/close, 390 px expanded-map view, named save/load and legacy entry, preset selection, wind configuration/launch, vertical speed, completed markers/log, manual 1x, reset, guide playback, ArcGIS layer and close-up repaired Sultanahmet.
- Standard local scene observed around 57–60 FPS on this host; this is not a Quest performance claim.
- XR emulator: trigger launch, wind/vertical telemetry, 25/25 map tiles, visibility-loss pause and exit. No console errors in these checks. Physical Quest 3 remains untested.
- XR gets the same flight/guide/roof/planning changes; its virtual map and telemetry include completion, vertical speed and wind. Plans are configured on the browser dashboard before entering VR.
- New city/season/designer features deferred. No service credentials, permissions, imagery zoom/budgets or billing settings changed.

Rollback deployment IDs:
- Standard 0.4.3: 6abe2ecf75b8621024b7d0a5 (7a79e7f).
- XR 0.1.1: 6abea1428036bacc3cfe97c0 (33a5fac).

Production deployment identifiers and verification are recorded in the workspace outputs release notes.
