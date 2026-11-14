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

The refund, team, and urgency example is loaded initially. **Reset example** restores it. Unsaved inputs reset on page reload.

## Save, import, and export questions

### Common lists: public and editable

**Question lists → Common · public & editable → Advertisement & spam detection** is a built-in example shipped in `common/question-lists/`. Everyone running the project receives this common list. Select it to edit its questions and use **Save shared changes** to update the shared JSON file, or **Save local copy** for a variant excluded from Git. Common files are intended to be version-controlled and shared with the project. Changes affect users of the same running project; distributing them to other checkouts uses the normal Git workflow. No hosting or internet publication is configured.

The policy prohibits advertising/unsolicited promotion, phone numbers, links/domain addresses, and email/social contact identifiers, even in otherwise non-promotional text. It includes five Noul questions: `advertising_spam`, `contains_phone_number`, `contains_link`, `contains_contact_details`, and `allowed`. Instructions cover obfuscation, English/Persian text, Persian/Arabic digits, and distinguishing contact numbers from ordinary prices, dates, and order IDs. These are model judgments for testing, not deterministic URL/phone filters; evaluate their probabilities on your own data before choosing rejection thresholds.

Click **Load 11 example texts** to fill the batch inputs with allowed conversation, ads without links, phone numbers, links, disguised domains, contact details, and Persian examples. The same inputs are in `examples/advertisement-spam-texts.json`. Clicking this button replaces the current state text list. Saved outputs for common lists still go to ignored `.local/` storage.

### Local lists

Under Questions, enter a **List name** and click **Save locally**. Lists are stored as JSON files in `.local/question-lists/` inside the project, which is ignored by Git. Choose a saved list to replace the question editor with its questions. **Save changes** updates the selected list; choose **New list** to save a separate copy of the current questions. Saved lists remain available after restarting the app.

**Export JSON** downloads the current questions, and **Import JSON** loads a file into the editor. Imports are validated before replacing the current list; click **Save locally** after importing to keep the list in this project. Both operations preserve structured instructions and typed criteria. State, provider settings, and API keys are excluded.

The exported format is `{ "version": 1, "name": "My questions", "questions": { ... } }`. Import also accepts a bare API question map or a request object containing `questions`. Files must be smaller than 1 MB. Saving and exporting questions works even if the state input is unfinished or invalid.

## Batch text tests and saved outputs

Choose **Text list** in the State panel and add one or more texts. Each text is sent as a separate `{ "text": "…" }` state with the same questions. Requests run sequentially, and each result appears in its own numbered output card. Errors are retained per text and the queue continues. **Cancel remaining texts** stops waiting for the active request and skips queued texts; requests already received by the provider may still finish and be billed.

Use **List style → Text fields** for individual inputs, or **Array [ ]** to edit the same list as `["Text one", "Text two"]`. Both views preserve text order, Unicode, whitespace, and line breaks. Invalid JSON drafts remain in the array editor and block evaluation until corrected; switching back to text fields requires valid array syntax.

Use **Import texts JSON** in Text list mode to replace the inputs from a file. Accepted formats are `["First text", "Second text"]`, `{ "texts": ["First text", "Second text"] }`, or arrays containing `{ "text": "…" }` objects. Files may contain 1–500 nonempty texts and be up to 5 MB. Unicode and multiline strings are preserved. Invalid imports leave the current inputs unchanged.

Save or select a question list, run your texts, then click **Save outputs to question list**. This also works for a single state. Finished or cancelled runs with completed results can be saved. The saved question list must match the questions used for the run; inputs and settings are captured when you start so later edits do not change the recorded run.

Outputs are stored in `.local/question-lists/<list-id>.runs/`, excluded from Git. Each JSON file contains the question-list name/ID and question snapshot, provider/model, input states, responses, per-text errors/status, timing, and token usage when returned by the provider. Use **Saved outputs** in the Output panel to reopen a run for the selected question list. Old runs keep their original question snapshot even if you later edit the saved list. Output history is local; API credentials are excluded.

**Export outputs JSON** downloads the displayed run, including its input texts, question snapshot, settings, responses, errors, and timing. It works for single or batch runs and reopened saved outputs, without requiring a saved question list. Finish or cancel a run before exporting; partial cancelled runs retain completed responses and mark skipped items.

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
