# UI guidelines

Use one Urbanity visual language. Before adding UI, inspect the current Super Admin and Community Admin portals and reuse their typography, colors, spacing, cards, tables, forms, badges, buttons, modals, sidebar, topbar, feedback, and empty/loading/error states.

## Design reference

`front-end/global.css` provides the shared baseline. The active Super Admin and Community Admin portals are the visual reference for management screens. Reuse their existing CSS classes and local patterns before adding new styles. Do not copy styles from legacy portals or old mock screens into active work.

## Palette

Use the existing light, navy, and blue palette. The values below are reference tokens, not permission to replace existing local styles wholesale.

| Purpose | Preferred values/pattern |
| --- | --- |
| App background | `#f9fafb`, `#f6f8fb`, or the existing portal background `#f5f7fb` |
| Surface/card | `#ffffff` with a subtle `#e5e7eb` / `#dfe6ef` border |
| Main text | `#111827`, `#172033`, or the current portal heading navy |
| Secondary text | `#6b7280`, `#64748b`, `#718096` |
| Sidebar/navy brand | `#0a1929` or the existing nearby sidebar navy |
| Primary action | Existing blue treatment: `#2563eb` or portal blue gradient (`#2d76b5` to `#205b93`) |
| Info | Light blue surface with dark-blue text, for example `#dbeafe` / `#1e3a8a` |
| Success | Light green surface with dark-green text, for example `#dcfce7` / `#166534` |
| Warning | Use the established amber/orange treatment sparingly for attention states |
| Danger/destructive | Light red feedback or the existing red action treatment; never use primary blue for destructive actions |

Use color to reinforce meaning, not as the only carrier of meaning. A status needs readable text and a badge/label as well as color. New gradients are limited to established hero/profile/primary-action patterns; do not add decorative gradients elsewhere.

## Typography and density

- Use the shared system stack from `global.css`; Super Admin's `Inter, system-ui, sans-serif` treatment is compatible where already loaded. Do not import a new web font.
- Page titles are typically `24px` to `26px`, strong/dark, with a short muted description beneath.
- Card/panel titles are typically `18px` to `19px`; section eyebrow labels use about `11px` to `12px`, uppercase, increased letter spacing, and muted/blue text.
- Normal UI text is generally `13px` to `14px`; table headers and metadata are smaller (`11px` to `12px`).
- Use weight and spacing for hierarchy. Do not make every label bold or every heading uppercase.

## Spacing, shape, and elevation

- Use an 8px-based rhythm: 8/12/16px for control gaps, 18/20/24px for card/panel padding, and 22/24px or more between major sections.
- Inputs and ordinary controls use about 8px to 10px radius. Cards/panels use about 10px to 16px. Pills/badges use a full rounded radius.
- Cards are white with a fine cool-gray border and soft blue-gray shadow. Avoid heavy dark shadows, hard black borders, or floating every element.
- Keep page content on a pale background; reserve dark navy for the sidebar and established hero sections.

## Application shell

- Desktop management portals use a fixed left sidebar (roughly 245px to 248px) and a white topbar.
- The sidebar owns primary navigation and logout. Active navigation uses a lighter navy background and white text.
- The topbar contains contextual title/portal name, notification control, and profile control/dropdown. Keep it white with a subtle bottom border/shadow.
- Keep only the main content region scrollable on desktop. Do not make the whole shell jump or reflow during ordinary CRUD operations.
- At narrower widths, follow the existing responsive behavior: collapse grids, allow content/table scrolling, stack header content, and preserve usable controls rather than shrinking text excessively.

## Components

### Buttons

- Primary: blue, white text, clear verb, used for the main action in a section.
- Secondary/outline: light surface, dark/navy text, visible border, for safe alternatives.
- Danger: red treatment for destructive actions only; require the project modal/confirmation pattern.
- Icon buttons: use for compact controls such as notification, preview, or close; provide `aria-label`/tooltip context and keep a minimum comfortable target size.
- Never style a navigation control like a destructive button or use more than one visually dominant primary action in a small card/header.

### Forms and modals

- Labels sit above controls and identify required/optional inputs clearly.
- Inputs/selects use white surfaces, cool-gray borders, 8px to 10px radius, and the existing blue focus ring.
- Put validation close to the affected field or form using shared error/success feedback styles.
- Use modal overlays for scoped create/edit/detail flows. Keep the modal scrollable, constrain height, and place cancel/close before the primary action.
- Do not open a new page for a simple edit/detail action when the existing portal uses a modal/detail panel.

### Cards, metrics, tables, and badges

- Use cards for grouped data, not as a wrapper around every paragraph.
- Metric cards contain a short label, strong value, and optional contextual hint/icon; align a metric grid consistently.
- Tables use muted uppercase headers, 13px body text, row hover, and horizontal overflow inside a table wrapper on narrow screens.
- Badges are compact pills. Map them consistently to status semantics and keep the label text unchanged from the backend enum/display mapping.

### Feedback and states

- Use the shared toast host for short success/info/error feedback.
- Render a loading state before delayed data and an explicit empty state when a collection has no records.
- Keep server error messages understandable; do not expose stack traces or raw authorization data.
- Preserve the current page/section when a mutation fails, and re-enable disabled controls after showing the error.

## Consistency

- Keep existing navigation placement and portal shell patterns.
- Reuse existing border radii, shadows, button hierarchy, status colors, icons, and form controls.
- A portal can have role-specific content but must still look like Urbanity.
- Do not introduce unrelated fonts, gradients, animations, icon libraries, or one-off component styles.
- Prefer existing inline SVG icons and existing CSS utilities over adding a dependency.
- Keep avatar, notification, dropdown, modal, and profile patterns aligned with the current topbar behavior.

## Interaction rules

- CRUD handled in JavaScript must call `event.preventDefault()`.
- Do not reload the full page for a mutation.
- After success, refresh only affected data, retain the current section, close or preserve modals deliberately, and show success feedback.
- Render failures and empty results visibly and clearly.
- For new normal workflows, use the application modal/toast pattern rather than native `alert`, `confirm`, or `prompt`.

Accessibility basics: use semantic buttons/labels, meaningful empty states, visible focus behavior, and text labels alongside status/color where practical.

## UI completion checklist

For a new or changed screen, verify the page title matches the active actor terminology; navigation points to an existing portal/section; all actionable controls have `type="button"` unless they submit a handled form; loading, empty, success, and error states use the existing visual treatment; and long tables/modals remain usable at narrower widths. Do not change UI merely to match stale screenshots or legacy markup.

Also check contrast, keyboard focus, button disabled state, overflow, mobile stacking, and that no action causes a full-page refresh. Visual polish must not weaken backend-driven authorization or replace real data with mock values.
