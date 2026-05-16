---
name: responsive-audit
description: >-
  Audits the responsiveness and front-end quality of a web page or app by
  rendering it at multiple viewport widths, capturing screenshots, and checking
  the code against a current best-practices checklist (responsiveness,
  accessibility, performance). Use this skill whenever the user wants to check
  how a site looks across screen sizes, asks for a "responsive audit",
  "responsive check", "mobile/tablet/desktop review", mentions breakpoints,
  layout breaking on small screens, DevTools responsive mode, or wants feedback
  on front-end best practices for an existing page. Use it even if the user only
  says something like "review my UI" or "check if my site works on mobile" —
  this skill is the right tool for any visual + code responsiveness review.
---

# Responsive Audit

Audits a running web page across multiple viewport widths and reports concrete,
prioritized issues. The audit has two halves that are always done together:

1. **Visual** — render the page at several widths, capture screenshots, and
   inspect them for layout breakage.
2. **Code** — review the actual CSS/markup against a best-practices checklist.

A screenshot tells you *that* something looks wrong; the code tells you *why*.
Reporting one without the other gives the user half an answer.

## When NOT to use this skill

- The user wants a brand-new component built from scratch → that is a design
  task, not an audit. Use the `frontend-design` skill.
- There is no running page and no source to inspect → ask the user for a URL
  or a project path first. The skill cannot audit something it cannot load.

## Required input

Before starting, confirm with the user **one** of these is available:

- A URL the audit machine can reach (a deployed site, or a local dev server
  such as `http://localhost:3000`), **or**
- A project path that can be started locally (e.g. a Next.js app where
  `npm run dev` serves the page).

If the user only has source code and no way to run it, the visual half is
impossible. Say so plainly and offer a code-only review instead — do not
pretend a static read of the CSS is a responsive audit.

## Workflow

### Step 1 — Get the page running and reachable

If the user gave a live URL, use it directly. If they gave a project path,
start the dev server in the background and wait for it to respond before
continuing:

```bash
cd <project-path>
npm run dev &      # or the project's own start command
# poll until the server answers, then proceed
```

Confirm the exact URL and the specific routes to audit. Auditing only the
home page is a common mistake — ask which 1–3 routes matter most (e.g.
landing, a content page, a form).

### Step 2 — Check the tooling

The visual capture needs Playwright with Chromium installed. Check first:

```bash
npx playwright --version
```

If Playwright is missing, install it before running the capture:

```bash
npm install -D playwright && npx playwright install chromium
```

If installation is not possible in the environment, **stop and tell the user**
— do not skip the visual half and silently downgrade to a code-only review.
The user asked to *see* how it looks; deliver that or explain why you cannot.

### Step 3 — Capture screenshots at multiple widths

Run the bundled capture script. It loads each route at a set of widths and
saves one screenshot per width.

```bash
node scripts/capture.js --url <url> --routes "/,/about" --out ./audit-output
```

Default widths cover the meaningful range, not just three arbitrary devices:

| Width  | Represents                                  |
|--------|---------------------------------------------|
| 320px  | Smallest phones — also the WCAG reflow check |
| 375px  | Common modern phone                         |
| 768px  | Tablet portrait / where layouts often flip  |
| 1024px | Small laptop                                |
| 1440px | Standard desktop                            |
| 1920px | Large desktop — checks for "thin stripe" content |

These are *starting points*, not rules. If the code reveals breakpoints at
other values (e.g. a custom `@media (min-width: 640px)`), add a capture a few
pixels on each side of that value — bugs cluster right at breakpoint
boundaries. See `references/responsive-checklist.md` for why content-driven
breakpoints beat device-driven ones.

### Step 4 — Inspect the screenshots

`view` each screenshot. For every width, judge it against the visual portion
of `references/responsive-checklist.md`. Look specifically for:

- Horizontal scrolling / content overflowing the viewport
- Overlapping or clipped elements
- Text too small to read, or lines too long (>~75 characters) on wide screens
- Tap targets too small or too close together on narrow widths
- Content squeezed into a thin column with vast empty margins on wide screens
- Images that overflow or distort

### Step 5 — Inspect the code

Read the relevant CSS/markup and check it against
`references/best-practices.md`. This is where you find the *cause* of what the
screenshots showed, plus issues that are invisible in a screenshot (e.g.
fixed-pixel font sizes, missing `alt` text, desktop-first media queries).

Read both reference files fully before writing the report — they hold the
actual criteria and are kept current; do not audit from memory.

### Step 6 — Write the report

Use this exact structure:

```markdown
# Responsive Audit — <page name>

## Summary
<2–3 sentences: overall state, worst problem, is it shippable>

## Critical issues
<Things that break usability for real users. For each: what, which width(s),
the screenshot it shows up in, the likely cause in code, and the fix.>

## Improvements
<Real but non-blocking issues, same format.>

## What's working
<Honest — name what is actually done well. Skip this section if there is
genuinely nothing, rather than inventing filler.>

## Suggested next steps
<Ordered by impact. Concrete and actionable.>
```

Rules for the report:

- **Be specific.** "The nav breaks on mobile" is useless. "At 375px the nav
  links overflow the right edge because `.nav` has a fixed `width: 600px`
  instead of `max-width: 100%`" is an audit.
- **Tie every visual issue to a width and a screenshot**, and to a code cause
  whenever you can find one.
- **Prioritize honestly.** A 2px misalignment is not a critical issue. Real
  horizontal scroll on phones is.
- **Do not pad.** If the page is in good shape, say so. A short honest report
  beats a long one full of nitpicks.

## Output location

Save the report as `audit-output/REPORT.md` alongside the screenshots so the
user has the findings and the evidence in one place. If the `present_files`
tool is available, present `REPORT.md` first, then the screenshots.

## Reference files

- `references/responsive-checklist.md` — what to check at each viewport, visual
  and structural. Read before Step 4.
- `references/best-practices.md` — front-end best practices for the code
  review: responsiveness, accessibility, performance. Read before Step 5.
- `scripts/capture.js` — the multi-width screenshot script used in Step 3.
