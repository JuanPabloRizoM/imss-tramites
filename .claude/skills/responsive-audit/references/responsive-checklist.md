# Responsive Checklist

What to check when auditing a page for responsiveness. Organized by *what kind
of problem* rather than by device, because devices change and the underlying
failure modes do not.

## Table of contents

1. Per-width checks
2. The breakpoint principle
3. Layout system checks
4. Typography and units
5. Images and media
6. Touch and input
7. Common failure patterns

---

## 1. Per-width checks

Run these against the screenshots from `capture.js`. The width column says what
each capture is really testing.

| Width  | Primary thing it tests |
|--------|------------------------|
| 320px  | WCAG 1.4.10 reflow: content must work in a single column with no loss of content or function. No horizontal scroll allowed. |
| 375px  | The most common real phone. Tap targets, stacked layout, readable text. |
| 768px  | The classic break point where multi-column desktop layouts collapse. Watch for half-collapsed, in-between states. |
| 1024px | Small laptop. Often falls in a gap between "tablet" and "desktop" rules. |
| 1440px | Standard desktop. The intended-looking layout. |
| 1920px | Large desktop. Watch for content stranded in a thin center column with huge empty side margins. |

At **every** width, the page must have **no horizontal scrollbar** unless it is
a deliberate horizontal-scroll component. `capture.js` flags this automatically
via `scrollWidth > clientWidth` — treat any flag as a critical finding until
proven intentional.

## 2. The breakpoint principle

Device-specific breakpoints (375 / 768 / 1024) are convenient starting points
but they are not where *your* layout actually breaks. The correct method:

- Resize slowly and watch where elements overflow, misalign, or collapse.
  Those exact widths are *your* breakpoints — they may be odd values like 642px
  or 911px.
- A breakpoint should *smooth a transition*, not trigger a jarring
  transformation. Think bridges, not walls.
- When the code shows a `@media` rule at a custom width, add a screenshot a few
  pixels on each side of it. Bugs cluster right at the boundary.

Foldables and the "in-between" zone (~700–900px) are where untested layouts
look worst — neither a clean phone layout nor a comfortable desktop one.

## 3. Layout system checks

- **Mobile-first**: base styles target the smallest screen; `min-width` media
  queries add complexity upward. If the CSS is mostly `max-width` queries, it
  is desktop-first — flag it (see best-practices.md for why this matters).
- **Flexbox vs Grid**: Flexbox for one-dimensional rows/stacks; Grid for
  explicit two-axis layouts. A common, healthy pattern is Grid for the page
  shell and Flexbox inside components.
- **Container queries**: a component should adapt to *its container*, not just
  the viewport. The same card in a 3-column grid and in a narrow sidebar should
  not be forced to look identical. If a component looks wrong only in one
  placement, missing container queries is a likely cause.
- **No fixed-width containers** on anything that must adapt. `width: 600px` is
  the single most common cause of mobile horizontal scroll; it should almost
  always be `max-width` plus a fluid width.

## 4. Typography and units

- Font sizes should use relative units (`rem`, `em`) so they respect the user's
  browser zoom and font settings. Fixed `px` font sizes are an accessibility
  and responsiveness problem.
- Fluid type with `clamp(min, preferred, max)` lets headings scale smoothly
  between a floor and a ceiling instead of jumping at breakpoints.
  Example shape: `font-size: clamp(1rem, 2.5vw, 1.25rem)`.
- Line length on wide screens should stay readable — roughly 45–75 characters.
  Text running edge-to-edge on a 1920px screen is a real finding.
- Text must stay legible down to 320px; check for clipping and shrinking.

## 5. Images and media

- Images need `max-width: 100%` (and usually `height: auto`) so they never
  overflow their container.
- A responsive `srcset` / `sizes` should serve smaller images to small screens.
  A desktop-resolution hero shipped to a phone inflates load time and hurts
  Largest Contentful Paint.
- Check that images keep their aspect ratio and are not stretched or squashed
  at any width.

## 6. Touch and input

- Tap targets should be large and well-spaced on narrow widths — small,
  tightly-packed buttons are unusable on a phone.
- Interactive elements must be reachable by keyboard, not just touch/mouse.
- A responsive menu (hamburger etc.) must open and close via keyboard, not only
  by tap.

## 7. Common failure patterns

Things that show up again and again — check for each:

- Horizontal scroll on phones (fixed widths, oversized images, un-wrapped long
  strings, negative margins).
- A nav bar that overflows instead of collapsing to a menu.
- A multi-column grid that never collapses, leaving tiny cramped columns.
- A layout that only "works" because it was tested at exactly 375 and 1440,
  and falls apart at 600px or 900px.
- Content stranded in a narrow strip with massive empty margins on wide
  monitors (a too-small `max-width` with no upper-range treatment).
- Modals or fixed-position elements that overflow small viewports.
