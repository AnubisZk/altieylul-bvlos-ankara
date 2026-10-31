# Weather presets · standard 0.6.0 / XR 0.3.0

The existing instructor area now offers Açık, Bulutlu and Puslu. Clear restores the existing atmosphere; cloudy adds coverage, reduces direct sunlight and adds diffuse fill; hazy increases the existing altitude-aware aerosol extinction. Changes use a frame-rate-independent exponential transition (about 95% in 4.2 seconds). The scene's native atmosphere is retained: its Fog near/far are a custom parameter block, not ordinary distance fog.

No new meshes, textures, external APIs or dependencies. Sky LUT updates during transitions are throttled to at most five per second and stop when settled. The precomputed reflection environment remains the original approximation; it is not regenerated per frame. Existing water geometry/material, maps, building detail, physics, wind controls, scores and layout CSS are unchanged. Presets are visual educational scenarios, not live weather or calibrated meteorological visibility. No rain or gust physics added.

Weather can be selected before launch or during flight. Initial and subsequent in-flight selections appear in the existing event log and CSV. Pausing the aircraft still allows the instructor to preview weather. Flight reset retains the selected weather; reloading the page starts clear. In Quest select the weather in the instructor area before entering the VR desk; the world camera monitor uses the same atmosphere. No new headset controls were added.

Validation: 43 standard tests and 46 XR tests pass, production builds and diff checks pass. New tests cover invalid inputs, gradual bounded interpolation, 30/90 Hz equivalence, interrupted transitions and exact return to clear. Desktop clear/cloudy/hazy visual checks; flight launch, weather event log, paused flight preservation; narrow 390px viewport menu checked without horizontal overflow; XR desk preview with hazy camera checked. Browser errors absent in fresh test sessions; desktop weather scenes observed at 60 FPS. Physical Quest 3 performance not measured.

Rollback: standard 223d085 / Netlify 6ac25cfc1b2c695e8c2d9f3c; XR e15946f / Netlify 6ac25d1edbc4b56791316171.
