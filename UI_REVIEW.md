# UI review — 26 October 2026

Reviewed the current working UI at 1440×900, 768×1024, 390×844, 320×568 and
844×390, using the production build in Chromium. Coverage includes Home, Work,
project details, About, Contact/chat/success, Ask Bud, booking calendar/details/
checkout/unavailable, admin login/dashboard, and 404.

## Fixed

- Booking incorrectly inherited the fixed landing page's body scroll lock.
  Small screens can now reach the terms checkbox and payment button naturally.
- Long admin emails/payment references and intrinsic date-input widths expanded
  the mobile layout beyond its viewport. Cards now shrink and wrap correctly;
  date controls, login cards, and filter buttons fit narrow screens.
- Mobile About/Contact stickers covered text, form controls and navigation.
  They now sit in the content flow on phones, with scrolling enabled over them;
  desktop dragging remains available.
- The deferred mascot could finish loading but remain invisible until a tap.
  Idle callbacks re-enter Angular and loading visibility uses a reactive signal.
  The browser check waits for the mascot to appear without interacting first.
- Short landscape layouts let the side rail cover navigation and placed content
  far below the first fold. The compact layout moves controls into the header,
  keeps content scrollable, and prevents sticker collisions.
- Project and Ask Bud dialogs did not fully handle keyboard focus. They now
  focus on opening, trap Tab/Shift+Tab, disable the background, close on Escape,
  and restore focus. Close buttons have larger targets and keyboard focus is
  visibly outlined throughout the app.
- Rich text in Ask Bud was laid out as separate flex items, breaking sentences
  into awkward columns on phones. System/output prose now wraps normally.
- The old generated app test still expected “Hello, frontend.” It was replaced
  with actual navigation/scroll regression checks.

## Validation

The full frontend suite passes 16 tests, including navigation scrolling,
outside-Angular loading updates, dialog keyboard behavior, and the existing
admin/booking regressions. The production build passes. Browser review uses
75 screenshots across the five sizes, checks viewport width, exercises chat and
booking transitions, verifies dialog focus/Escape, and tests booking scrolling.

Admin, contact and booking API responses were fixtures; no private production
data, outgoing email, or real payment was used. Screenshots are saved locally in
`D:/portfolio/tmp-ui-review-final`. This review covers Chromium emulation rather
than physical iOS/Android devices or a complete accessibility certification.

The existing home stylesheet size warning remains: about 37 kB against a 32 kB
warning budget, below the 40 kB error limit. The changes are prepared for review
and have not been deployed.


## Touch-emulated desktop regression and PostHog

The 1499×543 responsive touch screenshot exposed phone navigation being displayed by a coarse-pointer query without receiving its narrow-width styling. Layout now consistently follows the 900px width breakpoint. Compact navigation includes its own fixed positioning, dark buttons, active state and typography, including tablet widths. Reactive viewport state updates native contact forms, custom-cursor eligibility and body scrolling during a wide → phone → wide resize, without reloading. Pointer capability no longer selects the phone layout.

Verified at 1499×543 with touch emulation, 1440×900 desktop, 768×1024 tablet, 390×844 and 320×568 phones. No horizontal overflow or browser runtime errors were detected. Screenshot comparisons confirm the white unstyled navigation is gone. The PostHog real-SDK check intercepted and decoded 12 events without sending QA events to the real project; public-route/funnel events were present and private test values absent. Fresh admin/proposal loads made no analytics/config requests. Full frontend suite: 32 tests pass; production build passes. See POSTHOG.md for configuration and data boundaries.
