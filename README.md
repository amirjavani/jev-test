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
   - **Box**: experimental image localization. Upload a picture in State and ask where an object is in `images`. The server enables the experimental images header for assets or Box questions. Box support through GapGPT has not been tested.
5. Inspect **Request**, then **Run evaluation**. **Results** displays typed answers; **Raw JSON** retains the full upstream response, including errors. Cancel stops waiting in the browser; an already-submitted upstream request may still complete and be billed.

The refund, team, and urgency example is loaded initially. **Reset example** restores it. Unsaved inputs reset on page reload.

## Test images

In **State → Images**, click **Upload images** and choose one or more PNG/JPEG files (up to 16 MB each). Each image gets a preview, prepared dimensions, and a remove button. Large images shrink to a maximum side of 1568 pixels. Small or narrow images are padded with white to meet the 280-pixel minimum without stretching the picture. Images are prepared upright before sending.

Click **Use image test questions** to replace the current questions with a circle check and a color choice, then **Run evaluation**. Try `examples/images/red-circle.png` and `examples/images/blue-square.png` separately, or upload your own pictures and edit the questions. Uploading files only prepares them locally; clicking Run sends them to the selected provider.

Uploaded pictures are automatically referenced in `state.images`; your original text/JSON is retained in `state.context`. Questions can refer to the pictures in `images` or the first picture in `images[0]`. In Text list mode, the same selected images accompany **every** text. Removing an image removes its automatic reference; resetting clears the uploads. Runs and output exports retain image bytes so recorded inputs remain reproducible. Large runs may exceed the local API's 32 MB limit when saving outputs; use **Export outputs JSON** in that case.

Advanced settings still accepts manually supplied asset JSON for pictures inside instructions or criteria. It merges with uploads. Requests larger than 31 MB are blocked before evaluation to leave room for the local API envelope.

**GapGPT verified on November 14, 2026:** `typesafe/jev-1.14` returned HTTP 200 for both generated pictures using the experimental images header. With identical questions and no color/shape labels in the input text, the red circle returned `object_color: red` and `has_circle: 0.99`; the blue square returned `object_color: blue` and `has_circle: 0.01`. This verifies basic image classification through GapGPT; image accuracy remains experimental and Box was not part of this check.

To repeat this **paid live check**, run `npm run test:images:live`. It uses the configured server-side key, makes two small API requests, and writes redacted responses to ignored `.local/gapgpt-image-check.json`. It is separate from the mocked `npm test` suite.

## Save, import, and export questions

### Common lists: public and editable

**Question lists → Common · public & editable → Advertisement & spam detection** is a built-in example shipped in `common/question-lists/`. Everyone running the project receives this common list. Select it to edit its questions and use **Save shared changes** to update the shared JSON file, or **Save local copy** for a variant excluded from Git. Common files are intended to be version-controlled and shared with the project. Changes affect users of the same running project; distributing them to other checkouts uses the normal Git workflow. No hosting or internet publication is configured.

The list contains only one Noul question: `allowed`. It rejects unwanted advertising, unsolicited promotion, and spam based on intent and context in English/Persian and other languages. Ordinary questions, recommendations, and discussion or quotation of ads are allowed. Phone numbers, email addresses, handles, and links alone do not cause rejection. No reasons or contact-detail fields are requested.

For a request containing only Noul questions named `allowed` or ending in `_allowed`, the server converts each upstream probability to an independent boolean at a threshold of 0.5. A single `allowed` question returns `data: { "allowed": true }` or `data: { "allowed": false }` in the normal response envelope. Results, saved outputs, and exported outputs use these boolean results. Any invalid or missing probability produces an error instead of partial decisions; upstream errors are preserved. Other question configurations retain their full upstream response. These are model judgments; test the policy on your own data.

Click **Load 11 example texts** to fill the batch inputs with allowed conversation, ads without links, phone numbers, links, disguised domains, contact details, and Persian examples. The same inputs are in `examples/advertisement-spam-texts.json`. Clicking this button replaces the current state text list. Saved outputs for common lists still go to ignored `.local/` storage.

Three additional independent common lists are available, each with one `allowed` question and 12 example texts:

- **سیاست داخلی ایران**: rejects discussion of Iranian politics regardless of viewpoint, including neutral news and questions. Ordinary references to Iran, everyday administrative tasks, and non-political uses of words remain allowed.
- **فحش فارسی و انگلیسی**: rejects recognizable Persian/English profanity, including Finglish, disguised forms, and explicit quoted profanity. Neutral medical language and ordinary words with similar letters remain allowed.
- **توهین و بی‌ادبی مستقیم و غیرمستقیم**: rejects personal attacks, belittling, and clearly insulting sarcasm. Respectful criticism, firm boundaries, and reporting an insult without endorsing it remain allowed.

Each list evaluates only its own policy. Select a list and use **Load 12 example texts** to try ordinary cases, difficult cases, and attempts to override the instructions. Refresh the page to discover newly added common lists. No external API call is needed to load them.

The common list **بررسی ترکیبی تبلیغات، سیاست، فحش و توهین** evaluates all four policies in one request through four independent questions: `advertising_spam_allowed`, `iran_politics_allowed`, `profanity_allowed`, and `respect_allowed`. For each field, `true` means that policy passes and `false` means it is violated. There is no overall `allowed` field, explanation, or contact extraction. A violation of one policy does not affect unrelated decisions: for example, a polite political question can fail only `iran_politics_allowed`, while a report quoting explicit profanity can fail `profanity_allowed` without failing `respect_allowed`. Contact details and links alone still do not cause rejection. The list retains 20 example texts and returns the four booleans in `data`.

All four questions in the combined list use Persian instructions and criteria. The instructions themselves contain 28 labeled examples (6 for advertising, 6 for politics, 8 for profanity, and 8 for respect), covering permitted language, sarcasm, explicit/obfuscated profanity, Finglish, and quoted speech. These guide each independent decision; the separate **Load 20 example texts** batch remains available.

### Local lists

Under Questions, enter a **List name** and click **Save locally**. Lists are stored as JSON files in `.local/question-lists/` inside the project, which is ignored by Git. Choose a saved list to replace the question editor with its questions. **Save changes** updates the selected list; choose **New list** to save a separate copy of the current questions. Saved lists remain available after restarting the app.

**Export JSON** downloads the current questions, and **Import JSON** loads a file into the editor. Imports are validated before replacing the current list; click **Save locally** after importing to keep the list in this project. Both operations preserve structured instructions and typed criteria. State, provider settings, and API keys are excluded.

The exported format is `{ "version": 1, "name": "My questions", "questions": { ... } }`. Import also accepts a bare API question map or a request object containing `questions`. Files must be smaller than 1 MB. Saving and exporting questions works even if the state input is unfinished or invalid.

## Batch text tests and saved outputs

Every finished request displays **Request token usage** with **Input**, **Output**, and **Total** counts. The **Total usage · this run** panel above the results sums the displayed run and updates as requests finish, including text, image, and boolean moderation evaluations. Saved/reopened runs and JSON exports retain per-request usage. Older saved runs also work when usage is inside the original provider data.

Totals use provider-reported counts; when both input and output counts are available, their sum supplies a missing total. Missing counts display `—`, with coverage and a **Partial totals** notice when some finished requests do not report usage. Failed requests count when the provider supplies usage; skipped requests do not count. The summary covers the current run, not lifetime account usage.

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
