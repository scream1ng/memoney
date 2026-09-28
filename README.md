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
- Photo attachments remain temporary in the open sheet; they are not persisted.
- Photos and recordings are sent to OpenAI for processing. Responses use `store: false`.

Validation: `npm test`, `npm run build`, `npm run lint`.

API references: [Luna](https://developers.openai.com/api/docs/models/gpt-6-luna),
[transcription](https://developers.openai.com/api/docs/guides/speech-to-text),
[structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs).
