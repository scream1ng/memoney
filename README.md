# MeMoney

## Camera and voice setup

Set `OPENAI_API_KEY` in the server's `.env` for local use and in Railway's
`memoney` → `production` → `web` service variables for the hosted app.
The key needs model request access. Never put it in a `VITE_` variable or commit it.
Use `.env.example` for the remaining local server settings; local development
needs its own database and Google OAuth configuration for the local URL.

Run `npm run dev:api` and `npm run dev` in separate terminals. Camera/microphone
access requires HTTPS or localhost, and the user must be signed in.

- Receipt photos are resized to a 1600px long edge and sent to `gpt-6-luna`.
- Voice records up to 30 seconds, transcribes with `gpt-4o-mini-transcribe`,
  then uses Luna to extract the transaction. Thai and English are supported.
- Review the suggested fields, then press Save. Parsing never saves a transaction.
- Uploads are capped at 10 MB, with 10 requests/minute/user per server process.
  The rate limit resets on restart; it is not an account spending limit.
- Receipt photos are re-encoded on the phone to a JPEG (1600px long edge) and stored in Postgres (`attachments`, one per transaction, deleted with it). Only `server/photos.ts` knows where they live.
- Photos and recordings are sent to OpenAI for processing. Responses use `store: false`.

Validation: `npm test`, `npm run build`, `npm run lint`.

API references: [Luna](https://developers.openai.com/api/docs/models/gpt-6-luna),
[transcription](https://developers.openai.com/api/docs/guides/speech-to-text),
[structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs).

### API usage

Settings shows the signed-in account’s estimated OpenAI costs. The verified
`imbaoak@gmail.com` account also has an Admin tab with weekly/monthly totals and
all accounts, including accounts with no activity. Authorization is enforced on
the server; personal Home is unchanged.

Server startup adds the `api_usage` table and indexes idempotently. Tracking begins
with new camera/voice calls after deployment; old activity cannot be reconstructed.
Each upstream call is recorded before sending, and its token counters, estimated
USD cost and price snapshot are saved when available. Lost responses and missing
usage appear as unpriced calls, excluded from partial totals. No photos, audio or
transcripts are stored in this table. A voice entry can make two API calls.

Periods use Australia/Melbourne calendar dates, Monday-start weeks, and exclusive
end boundaries. Prices use Standard rates checked 2026-09-28 from the
[OpenAI pricing page](https://developers.openai.com/api/docs/pricing) and
[Luna model page](https://developers.openai.com/api/docs/models/gpt-6-luna).
Update `server/usage.ts` when prices or models change; saved historical estimates
remain unchanged. These estimates are not the OpenAI invoice or credit balance.
