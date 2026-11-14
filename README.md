# Jev Test

A local React playground for `typesafe/jev-1.14` through GapGPT. Edit the shared state, add typed questions, and inspect answers, probabilities, confidence, token usage, timing, and raw JSON. GapGPT is selected by default; the page also supports a direct TypeSafe connection.

## Run

Requires Node.js 22.12 or later.

```sh
npm install
```

Set the full token in the existing `.env` file (or copy `.env.example` to `.env` on a fresh checkout):

```dotenv
GAPGPT_API_KEY=your_full_token_here
TYPESAFE_API_KEY=
PORT=3000
```

```sh
npm run dev
```

Open http://localhost:3000. Restart the server after changing `.env`. The abbreviated token in the original example cannot authenticate; supply your complete key.

## Using the playground

1. Choose **GapGPT** and keep `typesafe/jev-1.14` as the model. To call TypeSafe directly, set `TYPESAFE_API_KEY` and select TypeSafe instead.
2. Enter state as plain text or JSON (string, object, or array).
3. Give each question a unique name. Instructions accept text or structured JSON, including the object and array forms in your cURL example.
4. Choose a type and supply its fields:
   - **Noul**: probability of yes (0–1). Optional criteria object with `true` and/or `false` descriptions.
   - **Choice**: a JSON object mapping 1–255 option names to descriptions.
   - **Score**: a JSON array of 1–10 ordered level descriptions. Scores start at zero and may be fractional.
   - **Box**: experimental image localization. Add base64 PNG/JPEG assets under Advanced settings and reference an asset key in state or instructions. The server enables the experimental images header for assets or Box questions. GapGPT support for experimental features is unverified.
5. Inspect **Request**, then **Run evaluation**. **Results** displays typed answers; **Raw JSON** retains the full upstream response, including errors. Cancel stops waiting in the browser; an already-submitted upstream request may still complete and be billed.

The refund, team, and urgency example is loaded initially. **Reset example** restores it. Inputs are kept in memory and reset on page reload.

## Credentials and request flow

The browser calls the local Express server, which reads the key from `.env` and sends the request to `https://api.gapgpt.app/v1/systemone`. Tokens are never injected into the React bundle, stored in browser storage, or returned by the configuration endpoint. `.env` and its variants are ignored by Git; `.env.example` is safe to commit. Do not use `VITE_` prefixes for secrets. The server binds to loopback and is intended for local development.

## Build and tests

```sh
npm test
npm run build
npm start
```

Tests mock upstream calls and cover request validation, provider routing, server-side authentication, experimental headers, missing keys, upstream errors, redaction, network failures, and timeouts. They do not spend API credits. A real GapGPT call requires your full key.

## Documentation reviewed

- [TypeSafe System One API reference](https://docs.typesafe.ai/api/system-one)
- [Question primitives](https://docs.typesafe.ai/primitives)
- [TypeSafe documentation index](https://docs.typesafe.ai/llms.txt)
- [Jev 1.14 model](https://openrouter.ai/typesafe/jev-1.14)

The API reference defines state and instructions as text, objects, or arrays; Choice criteria as an object; Score criteria as an ordered array; and Noul criteria as an optional true/false object. The GapGPT route and model identifier follow the supplied cURL example. Provider-specific compatibility must be checked with a live request.
