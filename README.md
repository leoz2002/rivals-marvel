# Multiverse Ball Arena — v0.2

Static app: serve `dist/`. Tests: `node test-engine.mjs`.

## Implemented roster
The six original creator images remain the circular sprites. Bruce, Hulk and Loki now use official stats; other characters retain configurable basic combat. Initial speed units map 10 to 180 px/s, 12 to 216 and 15 to 270, with the global speed setting scaling these together. Physics uses mass-weighted elastic collisions, fixed 120 Hz simulation, overlap correction, speed limits and per-target contact cooldowns.

### Bruce / Hulk
Bruce: 60 HP, damage 1, speed 10, mass 6, radius 27. Fury gains integer 1–5 each simulation second and 2–10 on nonlethal contact damage. Lethal damage eliminates Bruce even if it would complete the fury bar. At 100 fury: 1.2 s invulnerable transformation, three squash/stretch cycles, then Hulk with 800/800 HP (not additive), damage 10, speed 12, mass 20 and size 1.4. Browser speech synthesis says “Hulk Smash!” if enabled and supported; the player may mute it.

Hulk: Smash every 8 s, 18 damage in a 3-Hulk-radius area; Punch replaces contact damage with 10 every 4 s, launches the victim and applies up to three extra 5-damage impacts over a 4 s window; Jump every 14 s toward a visible opponent's position, lasts 1.5 s, avoids ground collision and damage while airborne. Landing deals 25 to the original target if still within contact range and 12 to other enemies within radius 100. Direct and area damage do not stack on one victim. Auto aim only occurs at ability activation; ordinary movement never pursues enemies.

### Loki
250 HP, damage 3, speed 15, mass 8. Energy projectile: 4 if relative distance decreases, otherwise 6; cooldown 2.5 s, range 360. Heal projectile: 3 to most injured nearby ally, self-heal allowed, cap at max HP; cooldown 3 s. Clone every 5 s (this is the summoning interval, not clone lifespan): 1 HP, damage 1, speed 9, gray appearance; only ray (2/3 damage) and heal (1 HP). Max 5 living clones per owner. No recursive clone summoning. Absolute safety ceiling: 180 living entities, with 60 manual placements.

Blink swaps with a living owned clone within 400, then becomes untargetable for up to 6 s; cooldown 16 s. Ground collisions and area damage still hit invisible Loki. Any ability cast ends invisibility. Player sees a faint ghost outline.

Metamorphosis: first cast at 25 s, copies another living non-clone character currently in the arena for 10 s, cooldown 25 s after expiry. Retains Loki's HP, contact damage, speed, radius and mass; copied ability damage/healing is multiplied by 0.5. Bruce's transformation and recursive morphs are blocked. Characters without defined abilities provide appearance only. Copied Hulk abilities use a temporary schedule so they can activate within the 10 s window. No continuous chase.

## Visuals and UI
Creator's added scepter, Hulk arms and Smash reference images are clipped into rendering masks at runtime. Staff glow, gray clones, projectile trails, rings, impact cracks, jump shadow/scale, fury HUD, cooldown panel, live ability log and audio toggle. Source images stay intact in `dist/assets`.

## Extension hooks
`emit`: collision, interval, health, damageReceived, damageDealt, special, abilityActivated, death. Per-instance custom `abilities` descriptors accept `{id,enabled,trigger,cooldown,condition,execute}` and separate cooldown storage. Recursion guard and independent timers protect chained abilities.

## Save/reset
Formations stay in browser localStorage. Save and load positions, teams and configuration. Restart restores original forms, stats and cooldowns, removes clones/projectiles and resets fury. Pausing and simulation speed affect every game timer. The tab pauses automatically when hidden.
