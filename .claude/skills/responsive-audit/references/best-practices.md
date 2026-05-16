# Front-End Best Practices

Criteria for the code-review half of the audit. Covers three areas:
responsiveness, accessibility, and performance. These are interlinked — a
poorly responsive layout usually also hurts accessibility and Core Web Vitals.

## Table of contents

1. Responsiveness in code
2. Accessibility (a11y / WCAG)
3. Performance (Core Web Vitals)
4. HTML structure and semantics
5. How to grade a finding

---

## 1. Responsiveness in code

- **Mobile-first CSS.** Base styles for the smallest screen; `min-width` media
  queries add complexity upward. This produces leaner CSS and fewer bugs.
  Quick tell: mostly `min-width` queries = mobile-first; mostly `max-width` =
  desktop-first → flag it.
- **Fluid units over fixed pixels** for layout dimensions and type: `%`, `rem`,
  `em`, `vw`/`vh`, and `clamp()`. Reserve `px` for things that genuinely should
  not scale (hairline borders, etc.).
- **No fixed-width containers** on adaptive content. Use `max-width` + a fluid
  width so the element shrinks on small screens.
- **Container queries** for component-level adaptation, media queries for
  page-level layout shifts. They complement each other; container queries do
  not replace media queries.
- **Content-driven breakpoints**, set where the layout actually breaks, not at
  device-name widths copied from a blog post.
- Prefer **pure CSS transitions and `matchMedia` listeners** over JavaScript
  that recalculates layout on every resize — JS layout work delays interaction.

## 2. Accessibility (a11y / WCAG)

Accessibility is a core pillar of a responsive build, not a final checkbox.

- **Color contrast** meets WCAG AA (4.5:1 for normal text, 3:1 for large text).
  This also helps anyone reading a screen in bright sunlight.
- **Every meaningful image has descriptive `alt` text.** Decorative images get
  empty `alt=""` so screen readers skip them.
- **Keyboard navigation** works for every interactive element — menus, buttons,
  forms, modals. Nothing should be reachable only by mouse or touch.
- **Visible focus states** — do not remove focus outlines without replacing
  them with something equally visible.
- **Touch targets** are large and well-spaced (helps limited-dexterity users
  and is also a responsiveness win).
- **Reflow (WCAG 1.4.10)**: content works in a single column at 320px CSS width
  with no loss of content or function. This overlaps exactly with good mobile
  design.
- **`prefers-reduced-motion`** is respected — heavy animation is disabled or
  reduced when the user asks for it.
- **Semantic landmarks and headings** (see section 4) so assistive tech can
  navigate the page.

## 3. Performance (Core Web Vitals)

Core Web Vitals are measured separately for mobile and desktop, and mobile is
weighted more heavily for mobile search ranking. The three to check:

- **LCP (Largest Contentful Paint)** — the largest element (often the hero
  image) rendering. A desktop-resolution image shipped to a phone because
  `srcset` is misconfigured is a classic LCP killer. Check image sizing and
  formats; oversized images are the most common cause of slow loads.
- **CLS (Cumulative Layout Shift)** — content jumping as the page loads.
  Reserve space for images (width/height or `aspect-ratio`), avoid inserting
  content above existing content, and load fonts without layout jumps.
- **INP (Interaction to Next Paint)** — responsiveness to user input.
  JavaScript-heavy responsive behavior (scroll animation, JS breakpoint
  calculation) delays this; prefer CSS.

Other performance notes:
- Serve appropriately sized and compressed images; use modern formats.
- A 3MB image that is instant on office Wi-Fi can take many seconds on a phone
  on a weak signal.

## 4. HTML structure and semantics

- Use semantic elements (`<header>`, `<nav>`, `<main>`, `<footer>`,
  `<button>`, `<article>`, etc.) rather than a pile of `<div>`s. Semantics
  drive both accessibility and predictable responsive behavior.
- One logical `<h1>` per page; headings nested in order without skipping
  levels.
- Use real `<button>` / `<a>` elements for interactions, not click-handled
  `<div>`s — the real elements come with keyboard and screen-reader behavior
  for free.
- Forms have associated `<label>`s for every input.

## 5. How to grade a finding

When writing the audit report, sort each finding honestly:

- **Critical** — breaks usability for real users: horizontal scroll on phones,
  overlapping/clipped content, unreadable text, keyboard traps, failing
  contrast on body text, content lost at 320px.
- **Improvement** — real but not blocking: desktop-first CSS that works but is
  fragile, fixed `px` fonts, missing `srcset`, line length slightly long, minor
  spacing inconsistencies.
- **Nitpick / skip** — sub-pixel misalignment, subjective polish. Do not pad
  the report with these; mention at most briefly if at all.

A finding is only useful if it names *what*, *where* (width/route), the *cause*
in code, and the *fix*. "Looks off on mobile" is not a finding.
