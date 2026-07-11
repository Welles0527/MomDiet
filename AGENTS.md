# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

## Durable Product Decisions

- The selected visual target is ideation option 2: a deep forest-green mobile dashboard with a circular daily-energy gauge, a warm paper meal sheet, and a dark three-item bottom navigation.
- The app is a single-user, mobile-first food planning tool. Planned grams count immediately toward the selected date's energy total.
- Foods store editable `kcal/1g` values in one shared unit table. Meals reference that table so energy edits recalculate every linked plan.
- Keep the nutrition app self-contained in this folder; do not alter the existing Clash Mode Switcher project in the parent workspace.
