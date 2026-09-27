# Expense/Income Tracker — Research

## 1. UI patterns to reuse

**Monefy** — Add flow: tap a category icon in the donut ring, enter amount, done (1 tap + amount = "one click" per store listing). Home: large interactive donut chart is the entire dashboard; balance shown center/top; categories double as tap targets around the ring. No separate icon grid — the donut segments ARE the category picker. Toggle: separate +/− (income/expense) buttons framing the chart. Bottom nav: minimal, mainly chart/records/settings. ("It's done in one click, because you do not need to fill anything except the expense amount" — [Apple App Store](https://apps.apple.com/us/app/monefy-bills-money-tracker/id1212024409))

**1Money** — Add flow: single tap opens entry, only amount required ("add transactions instantly with a single tap, requiring only the amount"). Home: chart-based summary of where money went, category list. Budget and debt/savings tracking modules exist alongside core tracker. Multi-currency with live rates. ([Google Play](https://play.google.com/store/apps/details?id=org.pixelrush.moneyiq&hl=en_US))

**Money Manager (Realbyte)** — Positions itself as "super easy and simple to enter data anytime, anywhere," graphical spending-tendency view, calculator built into entry, sub/main category hierarchy, double-entry bookkeeping under the hood, weekly/monthly/annual statistics toggle. ([Google Play](https://play.google.com/store/apps/details?id=com.realbyteapps.moneymanagerfree&hl=en_US))

**Spendee** — Add flow: manual entry, bank sync, or new "AI Receipt Scanner" that auto-fills price/category/description/photo from a photographed receipt. Bottom nav confirmed as Overview (analysis) + Budget sections, plus Wallets. Multiple wallet types (cash, bank, crypto, e-wallet) surfaced in an "All Wallets Overview." ([Spendee Help Center](https://help.spendee.com/category/129-spendee-features), [App Store](https://apps.apple.com/us/app/spendee-budget-app-planner/id635861140))

**Money Lover** — Emphasizes simple logging with categorization, income tracking, loan tracking, pie/bar chart insights, per-category spending limits. Add-transaction screen uses a numeric keypad with an integrated calculator (guided tutorial walks through keypad + calculator during entry). ([Google Play](https://play.google.com/store/apps/details?id=com.tj.money.lover), [MoneyLover Support](https://moneylover.zendesk.com/hc/en-us/articles/37017675637401-Getting-started-with-MoneyLover-a-short-guide))

**Wallet by BudgetBakers** — Heavier finance-manager positioning: envelope budgeting, automatic bank sync across "4,000 participating banks," multi-currency/multi-account reporting, shared finances. Less minimal/icon-first than the others — closer to a full PFM app. ([Google Play](https://play.google.com/store/apps/details?id=com.droid4you.application.wallet&hl=en-US), [BudgetBakers](https://budgetbakers.com/en/))

**Cashew** (open source, jameskokoska/Cashew) — README confirms: Material You design, light/dark + custom accent color, "Customizable Home Screen" with user-arranged widgets, "Detailed Graph Visuals" for spending patterns, custom categories with icon picker where default expense/income is set per category, biometric lock, Google login, cross-device sync via Firebase, CSV/Google Sheets import, "App Links" for auto-filled transaction creation (automation via URL scheme). No explicit tap-count or bottom-nav description in the README itself — UI mechanics beyond this aren't documented in-repo. ([GitHub README](https://github.com/jameskokoska/Cashew), Play listing: `com.budget.tracker_app`, App Store id `6463662930`)

**Consensus pattern** (common across most apps):
- Home screen = one glance: current balance/total + a ring or bar chart of category spend, transaction list below it.
- Adding a transaction is optimized to the smallest possible number of taps: pick category icon → type amount on a big numeric keypad → save; amount is the only required field.
- Categories are represented as icon+label tiles (grid or ring), not text lists, so add-flow is glanceable and language-light.
- A calculator-style keypad (not a plain numeric field) is standard for amount entry, often with an inline +/- calculator.
- Income vs. expense is a persistent toggle/segmented control near the amount entry, not a separate screen.
- Bottom nav is shallow: Home/Overview, Budget or Reports, Add (often a prominent center FAB), Accounts/Wallets, Settings/More — rarely more than 4-5 tabs.

## 2. Zero-cost receipt OCR options

| Option | Cost | Limits | Runs where | Receipt-field extraction | Thai support |
|---|---|---|---|---|---|
| Tesseract.js | Free (Apache 2.0) | No usage cap; accuracy/speed dependent on device | Client (WASM in browser) | No (raw text only, needs custom parsing) | Yes — `tha.traineddata` exists in the official tessdata language list ([tessdata repo](https://github.com/tesseract-ocr/tessdata)) |
| Google ML Kit Text Recognition v2 | Free | No usage cap | Native (Android/iOS on-device) | No (raw text only) | No — v2 only covers Latin, Chinese, Devanagari, Japanese, Korean scripts ([ML Kit docs](https://developers.google.com/ml-kit/vision/text-recognition/v2/languages)) |
| Apple Vision / Live Text | Free | No usage cap | Native (iOS/macOS on-device) | No (raw text only) | Not confirmed as supported in developer docs reviewed ([VNRecognizeTextRequest](https://developer.apple.com/documentation/vision/vnrecognizetextrequest)) |
| Chrome Shape Detection API (TextDetector) | Free | Experimental, behind a flag | Client (browser, Chrome/Edge only) | No | Unclear/unreliable — "not considered stable enough ... to be standardized," Chrome/Edge only, needs the Experimental Web Platform Features flag ([MDN/Chrome docs](https://developer.chrome.com/docs/capabilities/shape-detection)) |
| PaddleOCR | Free (Apache 2.0), self-hosted | No usage cap; needs your own server/GPU-CPU | Server (self-hosted) | No (raw text; layout models exist separately) | Yes — PP-OCRv5 ships a Thai recognition model (~82.68% accuracy reported); PaddleOCR-VL supports 109 languages including Thai ([PaddleOCR GitHub](https://github.com/PaddlePaddle/PaddleOCR)) |
| Google Cloud Vision (Text/Document Text Detection) | Free tier then pay-as-you-go | 1,000 units/month free, then $1.50/1,000 up to 5M, $0.60/1,000 beyond ([pricing](https://cloud.google.com/vision/pricing)) | Server (cloud API) | No (OCR text only; needs custom parsing for total/date/merchant) | Yes (general OCR language support, not receipt-specific) |
| Azure AI Document Intelligence (prebuilt receipt model) | Free tier then pay-as-you-go | 0–500 pages/month free (F0 tier), covers prebuilt receipt model ([pricing](https://azure.microsoft.com/en-us/pricing/details/ai-document-intelligence/)) | Server (cloud API) | Yes — dedicated prebuilt receipt model extracts merchant/total/date | Not confirmed for Thai in prebuilt receipt locales |
| AWS Textract | Free tier (3 months) then pay-as-you-go | Detect Document Text: 1,000 pages/mo free; Analyze Expense (receipts): 100 pages/mo free, 3-month window ([pricing](https://aws.amazon.com/textract/pricing/)) | Server (cloud API) | Yes — AnalyzeExpense extracts vendor/total/date | Not confirmed |
| OCR.space | Free API key | 25,000 requests/mo, 500 req/day/IP, 1MB file limit, PDFs ≤3 pages ([OCR.space API docs](https://ocr.space/ocrapi)) | Server (cloud API) | No (raw OCR text) | Listed as a supported OCR language on their engine (not independently verified here) |
| Mindee | 14-day free trial, no persistent free tier found | Trial credits only; paid plans start ~6,000 credits/mo at $44 ([Mindee pricing](https://www.mindee.com/pricing)) | Server (cloud API) | Yes — dedicated Receipt API | Not confirmed |
| Veryfi | Free tier | Up to 100 docs/month free, then ~$0.08/receipt ([Veryfi pricing](https://www.veryfi.com/pricing/)) | Server (cloud API) | Yes — dedicated receipt/invoice OCR | Not confirmed |
| Gemini API (vision, structured extraction via prompt) | Free tier | Google no longer publishes a full free-tier rate-limit table on the official rate-limits page; it directs users to check live limits in AI Studio ([Gemini rate limits docs](https://ai.google.dev/gemini-api/docs/rate-limits)). Free-tier Flash models are low-RPM/RPD (order of tens of RPM, low hundreds–low thousands RPD per third-party trackers, not independently confirmed here) | Server (cloud API call from client) | Yes — can be prompted to return structured JSON (total/date/merchant) directly | Yes, general multimodal/multilingual capability (not receipt-specific benchmarked) |

**Recommendation for a phone PWA:** Primary = **Tesseract.js client-side OCR** (zero cost, zero server, works offline, has a real Thai model) paired with your own regex/heuristic parser for total/date/merchant — avoids any API quota risk for a personal app. **Fallback = Gemini API vision call** when Tesseract's raw text is too messy to parse (handwriting-like receipts, poor lighting): send the photo + prompt for structured JSON, since it does the field-extraction Tesseract can't, and its free tier is enough for personal/low-volume use even though exact numeric limits aren't published.

**Caveat (verified on the [Gemini pricing page](https://ai.google.dev/gemini-api/docs/pricing)):** free-tier rows say "Content used to improve our products: Yes" — receipt photos sent on the free tier may be used by Google. Make the fallback opt-in per scan.

## 3. Stack notes

- Supabase free tier: 50,000 monthly active users, 500MB database storage, 5GB egress + 5GB cached egress, 1GB file storage, max 2 active projects, projects pause after 1 week idle ([supabase.com/pricing](https://supabase.com/pricing)).
- Firebase (Spark plan) free tier: Auth 50K MAUs (50 for SAML/OIDC), Firestore 1GiB storage, 50K reads/day, 20K writes/day, 10GiB/month network egress ([firebase.google.com/pricing](https://firebase.google.com/pricing)).
