# Historical exterior refinement · 4 October 2026

Visual-only release: standard 0.5.1 / XR 0.2.1. Existing UI, sea, maps, navigation, collisions, flight physics and weather settings are unchanged.

Curved lead roofs retain their exact vertices and ground anchors, with smoothed normals and procedural sheet seams. Flat roofs use parallel seams. Limestone receives fine masonry joints and subtle surface variation. Four mosque facades gain extruded window surrounds, dark reveals, sills, grilles and stepped cornices. Topkapi retains its original individual building anchors and window atlas. No new remote assets, paid services or textures are required.

These are representative details fitted to the existing simplified meshes, not measured reconstructions or photogrammetry. Existing source/licensing in NOTICE and ASSETS-LICENSE.md remains applicable; new procedural code is original to this adaptation. Architectural background: https://ekitap.ktb.gov.tr/TR-80059/sultan-ahmet-camii.html and https://www.millisaraylar.gov.tr/Lokasyon/2/topkapi .

Geometry budget (four merged relief batches each): Ayasofya 34,308 triangles; Sultanahmet 41,454; Suleymaniye 48,744; Yeni Cami 22,824. Roof shading adds no triangles. Geometry tests preserve positions/ground anchors, constrain relief budgets using actual hall dimensions, validate finite normals, preserve palace grass and prevent duplicate decoration.

Validation: 40 standard tests and 43 XR tests pass; production builds pass. Five landmarks visually inspected in the desktop browser, including rotated Sultanahmet view; no console errors in a fresh session. Desktop inspection displayed 60 FPS (an observation, not a device-wide guarantee). Normal flight starts and ArcGIS imagery loads. XR desktop control-room preview loads without errors. Physical Quest 3 headset performance has not been tested for this release.

Rollback: standard 99a0cdf / Netlify 6ac14e081eb252d7f0185e3a; XR 0a883bb / Netlify 6ac14e2d9b77b9d7689ef9ca.

Weather remains discussion-only: possible future presets are clear, overcast, hazy and light rain; assess reduced visibility and wind separately from visual effects. No weather functionality was added in this release.
