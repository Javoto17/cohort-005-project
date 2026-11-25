# Landing page design and course discovery

## Summary

Refresh the `/` landing page so visitors understand Cadence's self-paced learning offer and can move directly to course discovery. Keep the work local to the landing page and use the supplied palette in accessible light and dark themes.

## Product behavior

1. Keep all landing-page copy in English.
2. State the value of learning through self-paced courses in a clear headline and supporting copy. Use only product capabilities already present, such as instructor-led courses, progress tracking, and quizzes.
3. Make course discovery the primary hero action. It opens `/courses`.
4. Use the existing course and category counts and featured courses as product evidence. Do not add testimonials, rankings, outcome claims, or other unverified proof.
5. Keep the existing sign-in, sign-up, dashboard, course-detail, and theme-toggle paths available.
6. Keep the layout readable and usable on narrow and wide screens.

## Technical design

- Update the landing route in `app/routes/home.tsx`. Preserve its loader data and current-user-dependent navigation.
- Add landing-scoped semantic color variables in `app/app.css`, applied only below a landing-page root class. Do not change shared theme tokens.
- Use the supplied colors: `#a31621`, `#bfdbf7`, `#053c5e`, `#1f7a8c`, and `#db222a`. Assign colors to semantic roles by contrast, not by hue alone. Add dark-mode variants under the landing-page scope.
- Keep the page's course and category counts tied to loader data. Keep featured-course links tied to their existing slugs.
- Do not add dependencies, database fields, or routes.

## Decisions

- **Landing-only palette:** Shared theme tokens would also recolor the catalog and authenticated app. The requester chose `/` only, so landing-scoped variables limit the blast radius.
- **Course discovery as the primary action:** Registration could be a stronger acquisition action, but the requester chose exploring courses. Keep registration as the existing secondary navigation action.
- **Accessible palette roles:** A fixed assignment can produce low-contrast text. Choose foreground/background pairs that meet WCAG AA contrast, including in dark mode.

## Assumptions

- No conversion analytics or measurable uplift target was requested. The change improves the page's message hierarchy and routes; it does not claim a measured conversion increase.
- Use existing counts and course material only. Do not introduce new marketing claims or assets.

## Out of scope

- Changing the design system or colors on routes other than `/`.
- Translating the page, adding analytics, adding testimonials, or changing course content and data.

## Validation criteria

- `npm run typecheck` passes.
- `npm run lint:boundaries` passes.
- `npm run test` passes.
- `npm run test:mutation` passes.
- Browser verification confirms the landing page in light and dark modes at mobile and desktop widths, with readable palette pairings and working course-discovery links; capture visual proof with the computer-use tool.
