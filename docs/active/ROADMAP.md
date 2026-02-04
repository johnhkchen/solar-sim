# Solar-Sim Roadmap

> **Last Updated**: 2026-01-31

This document tracks project status and planned work.

---

## Strategic Direction

Solar-Sim is a sales enablement tool for saying "yes" to a planting plan. The product delivers value in four layers: sun mapping (the hook), plant intelligence (the moat), plan generation (the product), and marketplace connections (future). See `docs/specification.md` for the full vision.

The current technical foundation is strong—we have accurate sun calculations, shadow modeling with ShadeMap integration, tree detection from satellite data, and climate/plant recommendation infrastructure. The next phase focuses on exposing this power through a streamlined flow that takes users from address to exportable planting plan in 15 minutes.

---

## Completed Work

**Layers 1 complete**: Sun mapping infrastructure is solid. Solar position calculations, sun hours integration, shadow projection, ShadeMap API integration for real terrain/building shadows, tree placement with canopy detection, and observation point selection all work.

**Layer 2 foundation**: Plant recommendation system exists with light category matching. The horticultural integration module connects sun analysis to planting suggestions. Climate data (frost dates, hardiness zones, Köppen) is integrated.

**Archived phases** (1-11): Foundation tooling, solar engine, location system, shade modeling, climate integration, isometric view, ShadeMap integration, and tree canopy detection. See `docs/archive/` for details.

---

## Current Phase: Plan Generation Flow

The existing components are powerful but not exposed in a coherent user flow. The goal is a 15-minute experience from address to exportable plan.

### Active: S-022 Garden Planner & Heatmap

Seasonal exposure heatmaps are the "aha moment" that makes the value visible. Users need to see cumulative sun exposure across the growing season as a spatial heatmap, not just point-in-time shadows.

| Ticket | Title | Status |
|--------|-------|--------|
| T-022-00 | Create garden planner view | **Ready** |
| T-022-01 | Grid-based sun exposure calculation | Pending |
| T-022-02 | Heatmap rendering layer | Pending |
| T-022-03 | Analysis period selector | Pending |
| T-022-04 | Click-to-inspect sun exposure | Pending |
| T-022-05 | Reactive heatmap updates | Pending |
| T-022-06 | Isometric view heatmap | Pending |

### Next: S-023 Plan Generation Flow

The core UI transformation: turn the dashboard into a guided 15-minute flow from address to exportable PDF. This is the ticket that makes the product vision real.

| Ticket | Title | Status | Complexity |
|--------|-------|--------|------------|
| T-023-01 | Phase Navigation UI | **Ready** | M |
| T-023-02 | Zone Marking UI | Pending | M |
| T-023-03 | Zone-Aware Plant Selection | Pending | L |
| T-023-04 | Plan Builder Canvas | Pending | L |
| T-023-05 | PDF Export | Pending | L |
| T-023-06 | Mobile/iPad Optimization | Pending | M |
| T-023-07 | Extended State Persistence | Pending | S |

See `docs/active/stories/S-023-plan-generation-flow.md` for full details and `docs/knowledge/research/ui-ux-plan-generation-flow.md` for research findings.

### Running the Sprint

```bash
RALPH_ALLOW_MAIN=1 WORKTREE_STORY=S-022 just ralph
```

---

## Future Layers

### Layer 2 Expansion: Plant Intelligence

The Sunset Western Garden Book is the starting point for plant data. Encoding it properly enables queries like "show me perennials for Zone 14, part shade, low water, under 3 feet" with validated results. This is the moat—tedious to replicate, genuinely valuable.

**Key work**:
- Plant database schema design
- Sunset data encoding (method TBD)
- Query engine for multi-constraint filtering
- Preference system (native, edible, deer-resistant, etc.)

### Layer 4: Marketplace (Future)

Connect validated plans with local sourcing: nursery inventory, rare specimen finding, landscaper matching. This is complex because nursery data is fragmented and changes weekly. The plan-as-coordination-layer vision depends on eventually cracking this.

---

## Quick Reference

**Check status**:
```bash
just dag-status
```

**Run sprint**:
```bash
RALPH_ALLOW_MAIN=1 WORKTREE_STORY=S-XXX just ralph
```

**Preview next task**:
```bash
just prompt
```

**Refresh DAG from tickets**:
```bash
just dag-refresh
```
