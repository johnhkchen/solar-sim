## Research Task: Shade Modeling Deep Dive

 

You are researching shade modeling for Solar-Sim, a webapp that calculates sun hours for gardening. Read these files first:





CLAUDE.md (project conventions)



docs/knowledge/research/phase-6-shade-climate.md (initial research)



docs/happy_path.md (target user experience)



src/lib/solar/position.ts (existing sun position calculations)

### Context

The app currently calculates maximum theoretical sun hours. Users need to understand actual light conditions with obstacles (trees, buildings, fences) casting shadows. A south-facing yard with a 30ft oak tree has very different light than the raw calculation suggests.

### Research Questions to Answer

R1: Shadow Geometry Math





Given sun altitude and azimuth, how do we calculate shadow length and direction?



What's the intersection test for "does obstacle X block the sun from point P at time T"?



Write pseudocode or actual TypeScript for the core shadow calculation.

R2: Obstacle Data Model





What's the minimum data needed to represent useful obstacles?



How do we handle different obstacle types (solid building vs semi-transparent tree canopy)?



Should we model obstacles as points, lines, or polygons?



Propose a TypeScript interface for Obstacle and ShadeAnalysis.

R3: Performance Constraints





How many sun position samples per day are needed for accurate shade calculation?



If we check 100 obstacles × 365 days × N samples/day, what's the compute cost?



What caching or optimization strategies make this feasible in-browser?

R4: User Input UX





How do users describe "there's a big tree to the southwest"?



What presets would cover 80% of common obstacles?



Sketch a minimal UI flow for adding one obstacle.

R5: Output Visualization





How do we show "you lose 3 hours of afternoon sun due to the oak tree"?



Should we show a shade map, a timeline, or both?



What's the single most useful number or visual to display?

### Deliverable

Update docs/knowledge/research/phase-6-shade-climate.md with your findings under a new "## Deep Dive: Shade Modeling" section. Include:





Shadow geometry math with code snippets



Proposed Obstacle and ShadeAnalysis interfaces



Performance analysis with recommended sample rate



UX recommendation for obstacle input



Visualization recommendation

Do NOT create tickets yet. This is research only. The findings will inform ticket creation in a follow-up session.