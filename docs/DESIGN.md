# Design System

Minimalistic, modern, blue-accented. Supports light and dark mode automatically via `prefers-color-scheme`, with manual override via `.dark` class on `<html>` for a future toggle.

---

## Fonts

| Role | Font | Weights |
|---|---|---|
| Body / UI | Inter | 400, 500, 600 |
| Code | JetBrains Mono | 400, 500 |

Loaded from Google Fonts in `index.html`. CSS vars: `--font-sans`, `--font-mono`.

---

## Color Tokens

All colors are CSS custom properties defined in `src/index.css`. Use these — never hardcode hex values in components.

| Token | Light | Dark | Usage |
|---|---|---|---|
| `--bg` | `#ffffff` | `#07101f` | Page background |
| `--bg-subtle` | `#f8fafc` | `#0d1a30` | Section backgrounds, sidebar |
| `--surface` | `#ffffff` | `#0f1e35` | Cards, modals |
| `--surface-raised` | `#f1f5f9` | `#162540` | Hover states, code blocks |
| `--border` | `#e2e8f0` | `#1e3050` | Dividers, card borders |
| `--border-subtle` | `#f1f5f9` | `#132038` | Subtle separators |
| `--text-primary` | `#0f172a` | `#f0f6ff` | Headings, emphasis |
| `--text-secondary` | `#334155` | `#94a3b8` | Body text |
| `--text-muted` | `#94a3b8` | `#4a6080` | Timestamps, labels, captions |
| `--accent` | `#3b82f6` | `#60a5fa` | Links, buttons, active states |
| `--accent-hover` | `#2563eb` | `#93c5fd` | Hover on accent elements |
| `--accent-subtle` | `#eff6ff` | `#0c1f40` | Tag backgrounds, highlights |
| `--accent-border` | `#bfdbfe` | `#1e3a8a` | Tag borders, inline code borders |

---

## Shadows

| Token | Usage |
|---|---|
| `--shadow-sm` | Subtle card lift |
| `--shadow-md` | Cards, dropdowns |
| `--shadow-lg` | Modals, popovers |

---

## Radii

| Token | Value | Usage |
|---|---|---|
| `--radius-sm` | `0.375rem` | Badges, inline code |
| `--radius` | `0.5rem` | Buttons, inputs, small cards |
| `--radius-lg` | `0.75rem` | Post cards |
| `--radius-xl` | `1rem` | Large panels |

---

## Tailwind Utility Mapping

These CSS vars are registered in `@theme`, so they work as Tailwind utilities:

```tsx
// Background
className="bg-bg"              // --bg
className="bg-bg-subtle"       // --bg-subtle
className="bg-surface"         // --surface
className="bg-surface-raised"  // --surface-raised
className="bg-accent-subtle"   // --accent-subtle

// Text
className="text-text-primary"   // --text-primary
className="text-text-secondary" // --text-secondary
className="text-text-muted"     // --text-muted
className="text-accent"         // --accent

// Border
className="border-border"        // --border
className="border-border-subtle" // --border-subtle
className="border-accent-border" // --accent-border
```

---

## Dark Mode

**Automatic:** responds to `prefers-color-scheme: dark` with no JS required.

**Manual toggle (future):** add `.dark` class to `<html>`. The `.dark` class overrides the media query, enabling a user-controlled toggle.

```tsx
// Toggle dark mode
document.documentElement.classList.toggle('dark')
```

---

## Design Principles

1. **Whitespace over decoration** — breathe between elements, don't fill space
2. **Blue as the single accent** — no secondary accent colors; use opacity/shade variants
3. **Typography hierarchy** — size + weight + color (not decorative elements) create hierarchy
4. **Subtle surfaces** — cards barely lift from the background; borders are light
5. **Smooth transitions** — `200ms ease` on background/color changes for mode switching

---

## Component Patterns

### Card
```tsx
<div className="bg-surface border border-border rounded-lg p-6"
     style={{ boxShadow: 'var(--shadow-md)' }}>
```

### Tag / Chip
```tsx
<span className="bg-accent-subtle text-accent border border-accent-border
                 text-xs font-medium px-2.5 py-0.5 rounded-sm">
```

### Button (primary)
```tsx
<button className="bg-accent hover:bg-accent-hover text-white
                   font-medium px-4 py-2 rounded transition-colors">
```

### Muted label
```tsx
<span className="text-text-muted text-sm">
```
