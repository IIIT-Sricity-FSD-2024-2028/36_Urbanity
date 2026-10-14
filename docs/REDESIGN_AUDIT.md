# Urbanity frontend redesign audit

Design reference: `.agents/skills/redesign-existing-projects/SKILL.md`.
Scope: the active React application, public pages, shared components, and five actor portals. Backend behavior and legacy HTML remain outside this redesign.

## Findings and changes

| Finding | Applied change |
| --- | --- |
| Gradients, decorative metric circles, varied accent colors, and heavy card shadows distracted from operations. | One blue action color, cool neutral surfaces, navy navigation, quiet metrics, and semantic status colors. |
| Small uppercase labels and large profile banners created weak information hierarchy. | Sentence-case labels, larger body text, tabular numerals, compact profiles, and restrained headings. |
| Public pages used stock city imagery, unsupported impact figures, notification/automation promises, and placeholder links. | Community illustration, accurate report/repair/verification/feedback content, five-role explanation, and real navigation destinations. |
| Login had a separate visual identity. | Shared palette and illustration, mobile-friendly form, visible home link; existing validation, password toggle, and session flow retained. |
| Admin dashboards displayed totals without clear paths to work. | Community queue counts and administration links; platform community/user/report links. Counts remain derived from existing API data. |
| The hierarchy relationship was visually disconnected. | Community-to-apartment summary with counts and section navigation; existing forms and mutations retained. |
| Worker task tables required horizontal scanning on small screens. | Task lists emphasizing location, status, work type, proof date, and detail navigation. |
| Tower next actions and history needed stronger emphasis. | Highlighted next-step panel, clearer queue spacing, and current-event timeline marker. |
| Closed mobile navigation remained visually offscreen; detail routes lost active navigation. | Hidden drawer removed from keyboard navigation, focus containment and Escape/return-focus handling, expanded-state semantics, and correct parent highlighting. |
| Loading and fallback pages lacked useful structure or return paths. | Skeleton loading, keyboard skip links, focusable table scroll regions, and public fallback navigation. |
| Missing application favicon and metadata. | Local building favicon, description, and theme color. |

## Design constraints

- Keep React/Vite, existing CSS, inline SVG icons, API client, authentication, role guards, and actor services.
- Use native Segoe UI Variable / system fonts; no new font downloads or dependencies.
- Preserve actual records and status history. Never fabricate activity, metrics, dates, or occupancy.
- Keep semantic warning, success, and destructive colors even though the brand uses one action accent.
- Preserve the simulated-payment disclosure; do not add a payment gateway.
- Retain the existing Resident redesign and reuse the community illustration across public and resident pages.
- Do not introduce unsupported notifications, proof rejection, reassignment, reopening, or profile-editing controls.
- No hosted publication or changes to legacy HTML, backend logic, API payloads, or authorization.

## Validation

From `front-end/`:

```powershell
npm.cmd run build
npm.cmd run test:design
```

The rendering smoke check covers 31 actor routes in their initial state, all five portal shells, parent navigation on detail routes, landing destinations, login controls, safe task text, and empty worker lists. It does not execute browser interactions or complete complaint mutations.

Production build and the rendering checks passed. `git diff --check` passed. Existing Vite configuration and bundle-size warnings remain. No browser connection was available for screenshots, responsive visual inspection, or keyboard interaction verification.

Before accepting the visual design, check desktop and mobile layouts, navigation focus, long tables, modal overflow, report/image upload, worker proof submission, verification, resident feedback, and community CRUD in a browser against the existing backend.
