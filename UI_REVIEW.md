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
