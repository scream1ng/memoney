# MeMoney design system

iOS light look. Plain grouped grey background with white cards. Frosted glass is used on the dock, FAB and transaction sheets; Currency and Report Export use opaque bottom sheets.
All styles live in `src/styles.css`, with shared components in `src/components/ui.tsx`. There is no CSS framework, so reuse the existing classes.

## Tokens

### Color (`:root`)
| Token | Value | Use |
|---|---|---|
| `--bg` | `#f2f2f7` | page background, `theme-color` |
| `--card` | `#fff` | cards, rows, keys, round buttons |
| `--ink` | `#000` | primary text |
| `--muted` | `#6c6c70` | secondary text, placeholders, inactive tabs, disabled |
| `--sep` | `#c6c6c8` | 0.5px hairlines between rows |
| `--fill` | `rgba(118,118,128,.12)` | chips, seg track, icon-btn, disabled Save |
| `--fill-hi` | `rgba(118,118,128,.24)` | pressed fill |
| `--accent` | `#007aff` | primary action, active tab, selection ring, links, "guessed" hints |
| `--accent-ink` | `#fff` | text on accent |
| `--exp` | `#d70015` | expense, destructive, recording, errors |
| `--inc` | `#248a3d` | income |
| `--note` | `#b07000` | note field tile icon (amber; kept off `--accent` blue so it never reads as a category) |
| `--glass-bg` | `rgba(255,255,255,.62)` (sheet: `rgba(242,242,247,.9)`) | `.glass` surfaces |
| pressed row/key | `#e5e5ea` | `:active` on `.tx`/`.key` (hardcoded) |
| grab handle | `#c7c7cc` | `.grab` (hardcoded) |

Tints are `color-mix(in srgb, var(--x) N%, transparent)`:
- hint background is accent at 14–18%;
- warn background is exp at 10%;
- field-row tiles are `--note` at 16% or accent at 12%, with the icon in the full color.

Each category has its own color (`src/lib/categories.ts`, iOS system colors). These are only used as the fill of an icon tile or a bar, never as text.

### Type
The font stack is `-apple-system, SF Pro Text, …, Noto Sans Thai`, with a 16px/1.3 base. Numbers use `.num` (tabular-nums, 600).

| Size | Weight | Where |
|---|---|---|
| 46px (clamp 34–46) | 700, −1.5px | balance, sheet amount (shrinks to 26px) |
| 34px | 700, −1px | stats total |
| 30px | 700, −0.5px | month title |
| 28 / 20px | 700 | login / settings brand |
| 24px | 500 | keypad digits |
| 17px | 600 | sheet title, Save |
| 16px | 400 | body, inputs (never <16px on inputs: iOS zoom) |
| 15px | 400/600 | income/expense line, ai-panel label |
| 14px | 500 | chips |
| 13px | 400 / 600 uppercase | row sub-line, warn, heard; day headers |
| 12px | 400 | category labels |

### Spacing
The base unit is 4px. The values in use are 2, 4, 6, 8, 10, 12, 14, 16, 18, 20 and 24.
- Screen: 16px side padding and 16px between sections. Content is at most 480px wide; the sheet is at most 468px wide with a 6px inset.
- Row padding is 12px by 16px. Rows, keys and sheets have gaps of 8–12px.

### Radius
| Value | Use |
|---|---|
| 999px / 50% | pills, chips, seg, tabs, Save, round/icon buttons, FAB |
| 38px | sheet |
| 28px | Currency and Report Export bottom sheets |
| 26px | empty-state icon tile |
| 16px | cards, row groups, keys, pills, ai-panel, 52px category tiles |
| 14px | amount hint, 44px tiles (review category, field rows) |
| 12px | note input, warn |
| 10px | 36px category tiles, thumbnail, currency buttons |
| 8px | settings `.ico` (30px) |
| 4–6px | bars, hint labels |

### Shadow
| Level | Value | Use |
|---|---|---|
| glass | inset top highlight + 0.5px ring + `0 8px 24px rgba(0,0,0,.12)` | `.glass` only |
| FAB | `0 8px 20px rgba(0,122,255,.3)` | FAB only |
| raised | `0 1px 4px rgba(0,0,0,.12)` | selected seg button |
| thumb | 0.5px `--sep` ring + `0 4px 12px rgba(0,0,0,.12)` | receipt thumbnail |
| modal | `0 -8px 30px rgba(0,0,0,.14)` | opaque Currency and Report Export sheets |
| ring | `0 0 0 2.5px var(--bg), 0 0 0 5px var(--accent)` | selected category |
Cards have **no** shadow.

### Motion
- Press feedback is `scale(.9–.98)`, 0.1–0.15s.
- Sheets enter with `up` (0.28s, `cubic-bezier(.2,.9,.3,1)`) over a backdrop that uses `fade` (0.2s).
- A stacked sheet sends the one behind it to `scale(.94)`, `brightness(.9)`.
- `prefers-reduced-motion` turns off all animation.

## Components

| Component | Class / file | States |
|---|---|---|
| Icon button (44px) | `.icon-btn` | `:active` scale .92 and fill-hi |
| Round button (56px) | `.round` | `:active`; `:disabled` muted; `.armed` exp fill; `.dot` accent badge; `.voice-stop` ink pill |
| Primary pill | `.save` (136×56; full-width in narrow edit sheets) | `:disabled` fill with muted text |
| FAB (60px) | `.glass.fab` | Home: add menu; Stats: export current Week/Month; Categories: add for selected Expense/Income; hidden on other pages; `:active` scale .94 |
| Floating tab bar | `.dock .glass.tabs` (NavLink) | Home, Stats, Settings; `.active` accent on fill; stays left when no FAB |
| Segmented (44px controls) | `.seg` / `TypeToggle` | `[aria-pressed=true]` card and raised; `.e` exp, `.i` inc, `.n` ink |
| Chip (44px) | `.chip` | `.ph` muted, `.date-off` accent, `.hint` accent tint |
| Category tile | `CatIcon` `.cat` (36px list, 44px review row, 52px picker; 44px quick picker below 350px) | `[aria-pressed]` accent ring; `.hint` label tint; `:active` scale |
| Tx row | `TxList` `.tx` in grouped card | `:active` #e5e5ea; hairline from 64px |
| Settings row | `.set .row` (48px min) + `.ico` | `.danger` exp text |
| Admin entry | Settings `.set .row` | Show `Admin Panel` only to admins; no admin dock tab |
| Currency picker | `.modal-dialog.currency-sheet` | Opaque bottom sheet above dock; selected row has accent check; selection closes sheet |
| Report export | `.modal-dialog.report-export-sheet` | Opaque bottom sheet above dock; Download PDF and Download CSV only. PDF waits for preparation; CSV is available independently. Current Stats period appears in the title. |
| Stats summary | `.stats-summary` and `.stats-income-bar` | Current Week/Month; category colors fill bar segments and legend dots; muted empty state |
| Category management | `.category-list`, `.category-empty`, `.category-retry` | Built In above Your Categories; empty guidance points to FAB; load failure offers retry |
| Sheet | `.modal-dialog.glass.sheet` | `.sub` stacked; `.behind`; drag down / tap outside to close |
| Keypad | `.keys .key` (50px, 3 columns) | `.compact` 44px; `.del` muted; `:active` |
| Working / listening panel | `.ai-panel` (fixed 224px, replaces keypad) | `.voice-wave` responds to microphone level while recording; `.thumb` + `.spin` for busy |
| Field row (review/edit sheet) | `.review-category` / `.review-row`: own card each (16px radius, 64px min, 12×16 padding), 44px leading tile, label `small` + value, trailing chevron if it opens something | `.tile.note` note tint; `.tile.add` accent tint (receipt empty); receipt photo fills the tile (`object-fit: cover`) with a 0.5px `--sep` ring; focus = inset 2px accent outline |
| Inline error | `.warn` | exp tint with an icon |
| Empty state | `.empty .big` + arrow `.bob` | Home shows a period-specific status and Add entry action; filtered-empty results offer Show all entries. |
| Sign-in button | `.signin button` (52px) | `.primary` ink fill |

Icons are `lucide-react`: 18–22px inline, 24px in 52px tiles, 28px in the FAB.

## Do / Don't
- **Do** read colors only from tokens. Hardcode hex only for category colors and the `#e5e5ea` pressed state.
- **Do** mark every "AI/OCR guessed" value with the accent tint (`.hint`) until the user edits it. Never auto-save.
- **Do** keep touch targets ≥44px, and make main actions 56px.
- **Do** put the confirm action on the trailing (right) side.
- **Do** keep modal sheets above the dock and show the current Stats period in exported reports; do not ask for the period again.
- **Do** make inputs 16px or larger.
- **Do** make an in-progress state take the same height as what it replaces, so nothing jumps.
- **Don't** use glass on anything that isn't floating. Cards are plain `--card` with no shadow.
- **Don't** put Admin Panel in the dock or show its Settings entry to non-admin users.
- **Don't** use gradients, or borders on cards or buttons (hairline `--sep` separators only).
- **Don't** color amounts in lists red: expense amounts in the list and the income/expense line are ink, and only income is green.
- **Don't** add new shadow levels or radii outside the tables above.
- **Don't** use a solid-color tile for anything but a category. Non-category field tiles (note, receipt) use a soft tint so they never look like a second category.
- **Don't** leave a field row without a leading tile; every row in a sheet starts with one so labels line up.
- **Don't** use `.empty` for anything but the empty state, because it adds 48px padding. `.amount.empty` has to undo it.

## Known drift
- Inline styles with hardcoded values:
  - `Settings.tsx:23` uses the `#ff9500` icon color.
  - `Login.tsx:19` sets `fontSize: 14` / `textAlign` inline.
- `#e5e5ea` and `#c7c7cc` are hardcoded instead of tokens.
- `.empty` is a generic name that collides with other uses. See the Don't above.
- Light mode only: `color-scheme: light`, with no dark tokens.
- Currency and Report Export sheets repeat the same opaque backdrop, 28px radius, modal shadow, and header styles in separate classes.
- Currency, Report Export, and Category editor close buttons are now 44px. Category color choices wrap into four columns below 380px and stay at least 44×44px.
- `.orb` in Voice mode uses a gradient despite the no-gradients rule above.


## Export layout

- PDF uses **portrait A4**, 28pt side margins, and stacked transaction rows instead of a wide spreadsheet table. Check at a 375px viewing width, with no horizontal scrolling needed to read a row.
- Each row starts with the category on the left and signed amount on the right (22pt). Next: Income/Expense, date, and Receipt: Yes/No (18pt). The note follows (20pt), with an explicit empty-note placeholder.
- Keep income, expense, and net totals above the first page's transaction list. Repeat the report period, page number, and Transactions heading on subsequent pages. Long notes may continue across pages; never clip text below the bottom margin.
- Merchant is excluded from both export formats: it is not a field in the manual input form. Saved receipt/voice metadata does not introduce an extra export column.
- CSV columns: `Date,Type,Category,Note,Receipt,Amount,Currency`. Use Income/Expense labels, resolved custom category names, signed decimal amounts, and the configured currency symbol. Preserve multilingual text, commas, quotes, and line breaks; protect text cells from spreadsheet formulas.
- Export exactly the selected Stats period, in newest-first order. Weeks run Monday through Sunday and can cross month/year boundaries. Months include the first and last calendar day. Empty periods produce a PDF with zero totals and clear empty text, and a CSV with headers only.
- Download filenames: `MeMoney-week-YYYY-MM-DD.pdf/.csv` or `MeMoney-month-YYYY-MM.pdf/.csv`. The date for a week is its Monday. No Share PDF action.

## Touch and swipe behavior

- Transaction and custom-category rows reveal a 96px Delete action on a horizontal left swipe. Resolve direction after 10px of movement; a dominant vertical gesture stays a page scroll. Reveal when the offset passes halfway (48px). Only one row can remain open in each list.
- A swipe never deletes an item or opens its editor. Delete requires a fresh deliberate tap after the swipe has finished. A tap on an open row closes it. Transaction deletion offers Undo for five seconds before the server delete is committed.
- Bottom sheets drag from their header only. Pulls longer than 100px dismiss; short or upward pulls snap back. Buttons and fields do not initiate dragging. Pointer cancellation or lost capture must reset the gesture; busy operations may prevent dismissal.
- Keep an accessible alternative to every gesture: row tap for editing, explicit close/Cancel/Escape for modal dismissal, and a reachable Delete action. Entry and nested sheets include a visible close control.
- Every modal must keep keyboard focus inside it, make the page behind it inert, and return focus to its trigger when closed. Export, Currency, entry, nested, Category, and Passkey sheets use native modal dialogs.
- Anchor modal dialogs to the viewport, keep the heading and close control reachable on short screens, and scroll the content inside the sheet. Scrolling must not move the modal off-screen.

## UX/UI audit — 1 October 2026

Reviewed the source for all app screens and shared components. Browser walkthrough used the real UI with isolated sample API responses at 375×812 and 320×568. Sample API responses isolate testing from real account data. The eight findings below were subsequently fixed without schema changes.

### Verified flows

| Area | Evidence |
|---|---|
| Week/month exports | All four populated PDF/CSV downloads saved and reopened. Week spanning 28 September–4 October contained 4 rows (income $4,350, expenses $124.50); October contained 5 rows (income $150, expenses $166). Boundary entries outside each period were excluded. |
| Empty exports | Empty December and week of 12 October: PDF empty message/zero totals; CSV headers only. All four downloads saved correctly. |
| PDF readability | Actual downloaded portrait PDF rendered at 375px width. Category, type, date, notes, receipt status, and amount remained readable. Automated checks cover pagination, long notes, large amounts, Thai text, and supported currencies. |
| CSV content | Reopened actual downloads; checked row order, signed amounts, custom category labels, quoted/comma-containing notes, and absence of Merchant. Automated tests additionally cover UTF-8 BOM, multiline text, formula protection, and empty headers. |
| Home/manual/edit | Disabled save for missing amount/category; keypad amount entry; category choice; save entry; edit note/save changes; empty Home state inspected. |
| Row gestures | Transaction and category swipe reveal; only one transaction row open; swipe itself did not delete; explicit transaction Delete followed by Undo restored the row and totals. |
| Sheet gestures | Short currency/export pulls stayed open; long pulls dismissed. Main Add header pull dismissed the entry sheet. Cancellation, secondary pointers, and busy guards have existing hook tests. |
| Settings/categories/admin | Currency picker inspected on both sizes; category editor/duplicate-name error; admin account expansion and refresh; usage and empty Stats screens inspected. |
| Sign-in/capture/passkeys | Sign-in screen inspected; camera/voice, receipt review, permission handling, and passkey prompt reviewed in source. Real OAuth, camera/microphone capture, OCR, and device passkey enrollment were not exercised. |

### Findings resolved

Original findings retained for traceability. All eight corrections are implemented; verification and device limits follow the table.

| Priority | Screen / component | Finding | Concrete correction |
|---|---|---|---|
| P1 | Category editor / `.sheet.category-modal` | After navigating a scrolled page on a 320×568 phone, the opened dialog's top was −127px and Close was above the viewport. The generic sheet uses relative positioning. | Give native modal sheets viewport positioning; constrain height and scroll their content. Keep heading/Close visible regardless of underlying page scroll. Verify with the keyboard open too. |
| P1 | Export, Currency, Add, and nested sheets | Export Tab sequence escaped from CSV to the Home dock link while the dialog stayed open. These sheets use `role="dialog"` without enforcing modality. | Use native modal behavior or a focus trap plus inert background; restore focus on close. Include Escape and a visible close control in entry/nested sheets. |
| P1 | Transaction save/delete feedback — source review | Optimistic writes close the editor immediately; a server failure only logs and reloads (`store.ts`). The user receives no actionable save/delete failure message. | Keep a visible pending/error status, explain failed writes, and offer retry with the draft preserved. Do not imply the operation succeeded before it is confirmed. |
| P2 | Navigation / Home → Settings → Categories | Scroll position carried between screens; Settings branding and then Categories heading/toggle were above the viewport. | Reset scroll for a new full-screen route; preserve the list position when returning from an overlay editor. |
| P2 | Category editor color choices | At 320px, each color button measured 36×44px, below the documented 44px minimum width. | Wrap colors into fewer columns at small widths, with each button at least 44×44px. Keep the visible color dot 28px. |
| P2 | Home / Stats period selection | Week/month and week anchor are independent local state and reset on navigation; moving between Home and Stats can silently change the viewed period. | Preserve a shared selected period/week across these screens, or make the reset explicit. Keep the export tied to the displayed Stats period. |
| P2 | Empty Home | The wallet and arrow provide no text or accessible empty-state announcement. A filtered-empty period is indistinguishable from a first-time empty account. | Show “No transactions this week/month” and an Add entry action; distinguish empty filter results. |
| P2 | Settings passkey setup — source review | Add passkey has no pending indicator or visible error and no rejection handler. | Disable repeated setup while pending; show cancellation/failure feedback and retry. Verify on a device with WebAuthn support. |

### Fix verification

- Category editor at 320×568: viewport bounds top 6px/bottom 562px; color targets 66×44px. The header stays reachable while content scrolls. Physical on-screen keyboard behavior still needs device verification.
- Native export, currency, entry, and nested category dialogs: background controls disappear from the accessible modal tree; Escape closes only the top dialog; focus returns to the triggering control. Entry headers now include Close.
- Simulated save failure: pending state disables fields/actions; amount, date, category, and note remain in the editor; retry confirms the same entry before closing. Simulated editor delete failure keeps the entry visible. Row delete failure exposes Retry delete/Dismiss even after navigation; successful retry removes the entry. Undo still restores the row before any delete request.
- Full-screen navigation from scrolled Settings to Categories resets to scroll 0 with the heading at 14px. Opening and closing an entry overlay retains the Home list position.
- Home and Stats retain the shared selected week and week/month mode. Export reads the displayed Stats period.
- Filtered-empty Home announces the missing type and offers Show all entries. A fully empty period names its date range and offers Add entry; the action opens the editor.
- Passkey setup handles both returned errors and rejected requests, exposes pending status, and allows retry. Simulated endpoint failure was verified; successful hardware enrollment remains a device check.
- Automated regression coverage: native modal lifecycle/dismissal guards, confirmed writes, failed write retry, receipt failure, shared period state, and existing gesture/export tests. 100 tests pass; build and lint pass.

### Interaction requirements

- Do not close an entry editor until save/delete is confirmed. While pending, disable repeated writes and dismissal; on failure preserve the draft and present actionable text.
- Keep the same entry ID when retrying a new draft, including a receipt upload failure, to prevent duplicates.
- Reset scroll for new full-screen routes; retain the underlying route and scroll when opening/closing overlays.
- Share selected week/month and week anchor between Home and Stats for the current session.
- Passkey setup must show pending, success, and failure states; failure keeps setup available for retry.

Retain the existing visual language: grouped gray background, plain white cards, restrained floating glass, category colors, and explicit primary actions. No new theme or decorative effects are needed.
