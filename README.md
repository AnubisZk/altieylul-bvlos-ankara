# Altıeylül BİLSEM · BVLOS Drone Lab

School education simulator using the real Istanbul terrain, imagery and city pipeline from [Gökyüzü](https://github.com/erendikmenn/gokyuzu), original author Mehmet Eren Dikmen. Upstream base: `5acb51bc8074e390016a19cac2333fa4afee71a4`.

## Run

Node 22+: `npm ci`, `npm test`, `npm run build`, `npm start`. Open http://127.0.0.1:5188. World assets use the school's existing Cloudflare R2 distribution. The original school flight site is not modified.

## Drone

`tools/make_drone.py` generates the original BILSEM Surveyor in Blender 5.1. `models/bilsem-surveyor.blend` is the editable master; GLB is the web model. Four individually animated rotor assemblies, machined motor housings, battery latch, landing gear, GNSS dome, antennas, obstacle sensors and a gimbal camera. No commercial aircraft trademarks.

Version 0.2.1 adds satin white identity panels on both sides and the top. The school logo and Turkish wordmark come from the user-supplied artwork in `models/branding/altieylul-bilsem.png`, used unchanged via UV mapping and embedded in the GLB and Blender file. It is school identity artwork supplied for this simulator; no separate redistribution license is asserted.

## Lessons

Plan a route (up to 12 waypoints within 2 km), set 30–120 m AGL, run an automated takeoff/mission/return/landing. Hold and resume, manual desktop keyboard flight, pause and 4× time compression. Instructor can introduce link loss (5-second RTH), low battery or wind (speed/energy penalty). Save a mission locally; export telemetry and events as CSV. No student accounts or names are collected.

## Flight assessment · 0.4.3

The existing end-of-flight dialog now shows a transparent 100-point classroom flight-safety rubric, completion count, return initiator (pilot or autopilot), and targeted suggestions. The existing report button reopens this result after landing; its CSV button downloads telemetry, events and the same assessment. During flight CSV results are explicitly unfinished. The dashboard and upper-right map layout are unchanged. No PDF, student identity storage or additional instructor controls are introduced in this stage.

Five categories contribute 20 points each: route tracking, selected cruise altitude, the 2 km lesson boundary, landing energy reserve and safe landing. Route tolerance is 30 m, altitude tolerance ±10 m. Continuous excursions have a two-second grace period: reaching two seconds counts one event (2 points), and every accumulated five seconds beyond grace costs another point, capped at 20 per category. Takeoff/landing are excluded from cruise scoring; return uses its own direct corridor, including holds. Boundary crossings cost 10 points each. Landing under 10% costs 10 energy points, depletion costs 20; an instructor-imposed low percentage alone is not penalized. No safe landing caps the total at 39, with an explicit explanation.

Mission completion and duration are separate observations, so safe early return is not penalized. The score includes autopilot behavior and is not an individual pilot qualification. Special restricted areas and near-miss risk are not measured. Metrics are accumulated at simulation ticks (not frame counts or one-second telemetry samples), stop on pause, and reset per flight. Terminal telemetry is retained in the CSV. Rubric logic and rendering are separate modules in `drone/assessment.js` and `drone/result.js`.

## Educational limits

This is simplified kinematic training, not a calibrated flight controller or certified training device. Wind is a speed and energy penalty, not CFD. Signal percentage is an illustrative range model; it does not predict RF coverage. Terrain/buildings are real geospatial source data but not live or complete obstacle records. Limits are lesson parameters, not legal airspace guidance. Takeoff location is a simulated classroom scenario, not an operational recommendation. First load requires internet; OSM tiles and R2 data are streamed. No hardware connection.

## Attribution / license

Preserve `LICENSE`, `NOTICE`, `ASSETS-LICENSE.md` and all source headers. Upstream code Apache-2.0; world asset pack CC BY-NC 4.0. Map data includes Copernicus DEM, Sentinel-2, OSM and Overture. The classroom adaptation and original drone are additions; retain original credits. OpenStreetMap tile policy applies to the on-demand map view; no bulk/offline downloading.

## Deployment

Netlify static site, separate from the original school flight game. Run tests/build, then deploy `dist` with Netlify CLI. `netlify.toml` also supports Git builds. Models are included in static assets; existing terrain stays in the school's R2 bucket. The previous Cloudflare Worker configuration is retained for portability.

## Environment · 0.2.0

Original procedural scenery adds a textured 14 × 10 m training pontoon, rails, fenders, mooring hardware, equipment cases, life ring and windsock. Animated passenger ferries and a harbor launch have wakes; buoys bob and seabirds circle. Boat paths are accepted only when all sampled points lie on the map's water mask. These objects and their movements are illustrative classroom additions, not real vessel positions or surveyed infrastructure. Existing real terrain, imagery and map sources are preserved. Nearby solid props and vessels participate in simplified collision detection; reduced-motion preferences suppress flapping and bobbing.

## Six-point mission and heritage · 0.3.0

The default route now has six points between Üsküdar and Sarayburnu (4.14 km total, approximately seven minutes at 80 m AGL). All points stay inside the existing 2 km lesson radius. User-authored routes and saved plans still support up to 12 points.

Ayasofya, Sultanahmet, Süleymaniye, Yeni Cami and Topkapı retain the upstream detailed LOD0 within 4.5 km, instead of switching to the simpler distant model at roughly 1.1–1.3 km. Texture anisotropy is capped at the GPU-supported level. Four mosque models also receive batched arched-window relief and mullions, fitted to their existing local wall dimensions. These are stylized educational details, not surveyed restoration models. Topkapı retains its individually grounded upstream buildings, courtyard, roofs and walls.

The “Tarihi yapı incele” selector offers an orbit/zoom camera for each of the five sites without relocating the drone. Entering this view during flight pauses the simulation. Select the drone camera and use “Devam et” to continue. Starting a new mission automatically returns to the drone camera. Changes are local to this BVLOS app; the upstream game and shared asset bucket are unchanged.

## Music · 0.3.1

User-supplied `Seven_Hills_at_Dawn.mp3` is included unchanged as `music/seven-hills-at-dawn.mp3`. The streaming audio loops at normal speed and starts after a user gesture, initially at 18% volume. Music toggle and volume preferences persist locally. Simulation pause and backgrounding the tab pause playback; resuming continues the current track position. Playback errors remain separate from the flight controls. The track is supplied for this simulator; no artist identity or independent redistribution license is asserted.

## Guide and ground detail · 0.4.0

The header guide opens a compact, scrollable dialog with the existing quick start and the complete user-supplied general BVLOS education text, arranged into an introduction and nine collapsible chapters. The general text mentions features not implemented here; a visible note distinguishes it from the current controls. Opening any dialog during flight pauses the simulation; resume explicitly after closing.

The supplied `audio (3).wav` is only 5.886 seconds (44.1 kHz stereo PCM), not the whole narration. It is preserved unchanged as `music/guide-voice-sample.wav` and labeled as a short sample. Playback uses a 128 kbps MP3 conversion (95 KB) through a custom play/pause button; the original WAV remains in the source. Full text can be read paragraph by paragraph with the browser's Turkish SpeechSynthesis voice, with chapter selection, pause/restart and highlighted paragraphs. This is **not** a clone of the supplied voice. Availability depends on installed Turkish voices; unsupported devices show a message and retain the text/sample. Narration temporarily pauses music without changing its saved preference. Closing, Escape, switching dialog or hiding the tab stops narration. Speech resumes at the beginning of the interrupted paragraph.

`data/ist/heritage-ground.json` is a geographically bounded OpenStreetMap way extract, © OpenStreetMap contributors, ODbL-1.0 (see its timestamp, bounds, IDs and full retained tags). Roads, pedestrian ways and closed park/grass polygons are painted into a 2048² georeferenced canvas texture and sampled on the **existing terrain**: no new floating ground mesh, terrain heights, obstacle claims or coastline changes. Colors and fallback widths are illustrative, not an orthophoto. The database is publicly downloadable from credits under ODbL; application code retains its separate license. Multipolygon-only parks are not filled. Above/below-ground ways, bridges and tunnels are excluded. Source API was queried once for a static extract; the deployed page never queries Overpass. Ground detail, medium water and capped 8× anisotropy improve close views; imagery source remains Sentinel-2. Failure of the optional overlay preserves the base imagery.

## Turkish female narration · 0.4.1

Removed the short voice sample, its play button and explanatory text, and both sample audio files from the app and distribution at the user's request. The original user file in Downloads is untouched. The 0.4.0 browser speech implementation described above is replaced by 82 paragraph MP3s under `music/guide-emel/`, synthesized from the unchanged guide text with Microsoft's Turkish female Emel Neural voice at -5% rate. No browser speech package or runtime speech service is required. Audio loads on demand after pressing Listen. Pause resumes at the same audio position; chapter selection, restart, paragraph highlighting and music priority remain. Closing the guide or hiding the tab pauses narration. Network failures leave the readable guide available and show a retry message.

## Aerial imagery integration · 0.4.2

The optional ArcGIS World Imagery loader is disabled while `data/ist/imagery.json` has an empty API key. Existing Sentinel-2 and OSM ground rendering remains available. The enabled build uses an ArcGIS Location Platform public-application key. Live loading and georeferenced rendering were verified locally on 2026-09-30; release evidence is recorded separately.

The loader streams an 8×8 tile window around the camera target at zoom 17, capped to the Istanbul lesson area. It uses four concurrent requests, a 2048² canvas texture, and at most 128 retained ImageBitmaps after each update. The local Mercator transform accounts for UTM grid convergence; tests cover sub-pixel alignment near the historic sites. Missing keys make no ArcGIS calls; failed authentication, quota or network access stops subsequent requests for the session. No photo tiles are bundled, exported offline or cached on our server. Browser memory is the working cache.

For a new installation, create **public application** API key credentials with only **Basemap styles service** (`premium:user:basemaps`), no private item access, and referrers limited to `https://altieylul-bilsem-bvlos.netlify.app` and local QA `http://127.0.0.1:5188`. Keep pay-as-you-go disabled for the free-tier trial. Put the restricted public-app key in ignored `imagery.local.json` as an object with an `apiKey` string; the build writes it to the published imagery configuration. This client key is browser-visible by design. Never use an account password, admin key, unrestricted key, or private-data credential. The source archive excludes the local key; rerunning the source without it safely uses the existing ground.

Provider attribution is shown beside the camera when photo tiles have loaded. Ground heights, coastline alpha, collision data and flight logic are unchanged. World Imagery is streamed live from the provider, but the photographs are not live camera feeds. Zoom 17 has approximately 0.90 m display pixels at Istanbul; this does not certify source capture resolution or date. The 3D building models remain simplified educational representations. The current key expires on 2027-09-29 at 23:59 Europe/Istanbul. Renew it with the same restricted scope before expiry and rebuild/redeploy; never include the key in a source archive.
