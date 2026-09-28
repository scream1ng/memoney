# MeMoney design system

iOS light look. Plain grouped grey background with white cards. Frosted glass is used only on floating chrome (dock, FAB, sheets).
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
| `--glass-bg` | `rgba(255,255,255,.62)` (sheet: `rgba(242,242,247,.9)`) | `.glass` surfaces |
| pressed row/key | `#e5e5ea` | `:active` on `.tx`/`.key` (hardcoded) |
| grab handle | `#c7c7cc` | `.grab` (hardcoded) |

Tints are `color-mix(in srgb, var(--x) N%, transparent)`:
- hint background is accent at 14–18%;
- warn background is exp at 10%.

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
The base unit is 4px. The values in use are 2, 4, 6, 8, 10, 12, 14, 16, 20 and 24.
- Screen: 16px side padding and 16px between sections. Content is at most 480px wide; the sheet is at most 468px wide with a 6px inset.
- Row padding is 12px by 16px. Rows, keys and sheets have gaps of 8–12px.

### Radius
| Value | Use |
|---|---|
| 999px / 50% | pills, chips, seg, tabs, Save, round/icon buttons, FAB |
| 38px | sheet |
| 26px | empty-state icon tile |
| 16px | cards, row groups, keys, pills, ai-panel, 52px category tiles |
| 14px | amount hint |
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
| FAB (60px) | `.glass.fab` | `:active` scale .94 |
| Floating tab bar | `.dock .glass.tabs` (NavLink) | `.active` accent on fill |
| Segmented (44px controls) | `.seg` / `TypeToggle` | `[aria-pressed=true]` card and raised; `.e` exp, `.i` inc, `.n` ink |
| Chip (44px) | `.chip` | `.ph` muted, `.date-off` accent, `.hint` accent tint |
| Category tile | `CatIcon` `.cat` (36px list, 52px picker; 44px quick picker below 350px) | `[aria-pressed]` accent ring; `.hint` label tint; `:active` scale |
| Tx row | `TxList` `.tx` in grouped card | `:active` #e5e5ea; hairline from 64px |
| Settings row | `.set .row` (48px min) + `.ico` | `.danger` exp text |
| Sheet | `.sheet-wrap > .glass.sheet` | `.sub` stacked; `.behind`; drag down / tap outside to close |
| Keypad | `.keys .key` (50px, 3 columns) | `.compact` 44px; `.del` muted; `:active` |
| Working / listening panel | `.ai-panel` (fixed 224px, replaces keypad) | Browser speech text can be corrected before processing; `.thumb` + `.spin` for busy |
| Inline error | `.warn` | exp tint with an icon |
| Empty state | `.empty .big.bob` | — |
| Sign-in button | `.signin button` (52px) | `.primary` ink fill |

Icons are `lucide-react`: 18–22px inline, 24px in 52px tiles, 28px in the FAB.

## Do / Don't
- **Do** read colors only from tokens. Hardcode hex only for category colors and the `#e5e5ea` pressed state.
- **Do** mark every "AI/OCR guessed" value with the accent tint (`.hint`) until the user edits it. Never auto-save.
- **Do** keep touch targets ≥44px, and make main actions 56px.
- **Do** put the confirm action on the trailing (right) side.
- **Do** make inputs 16px or larger.
- **Do** make an in-progress state take the same height as what it replaces, so nothing jumps.
- **Don't** use glass on anything that isn't floating. Cards are plain `--card` with no shadow.
- **Don't** use gradients, or borders on cards or buttons (hairline `--sep` separators only).
- **Don't** color amounts in lists red: expense amounts in the list and the income/expense line are ink, and only income is green.
- **Don't** add new shadow levels or radii outside the tables above.
- **Don't** use `.empty` for anything but the empty state, because it adds 48px padding. `.amount.empty` has to undo it.

## Known drift
- Inline styles with hardcoded values:
  - `Settings.tsx:23` uses the `#ff9500` icon color.
  - `Login.tsx:19` sets `fontSize: 14` / `textAlign` inline.
- `#e5e5ea` and `#c7c7cc` are hardcoded instead of tokens.
- `.empty` is a generic name that collides with other uses. See the Don't above.
- Light mode only: `color-scheme: light`, with no dark tokens.
