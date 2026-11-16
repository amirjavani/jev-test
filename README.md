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

**Question lists → Common · public & editable → Advertising & Spam** is a built-in example shipped in `common/question-lists/`. Everyone running the project receives this common list. Select it to edit its questions and use **Save shared changes** to update the shared JSON file, or **Save local copy** for a variant excluded from Git. Common files are intended to be version-controlled and shared with the project. Changes affect users of the same running project; distributing them to other checkouts uses the normal Git workflow. No hosting or internet publication is configured.

The list contains only one Noul question: `allowed`. It rejects every recognizable phone number, email address, link, or domain, including obfuscated, quoted, public, synthetic, support, and in-app values. It also rejects advertising outside this app, requests or exchanges for likes/comments (including for in-app content), and meaningless letter strings or repetitive spam in Persian, English, and Finglish. Promotion of this app’s own features, such as internal courses and duels, is allowed only when no other violation is present; an external course or duel is not exempt. Meaningful conversation, genuine lesson questions, ordinary numbers, and technical identifiers remain allowed. No reasons or contact-detail fields are requested.

For a request containing only Noul questions named `allowed` or ending in `_allowed`, the server converts each upstream probability to an independent three-way decision: `true` above 0.9, `false` below 0.3, and `"human"` from 0.3 through 0.9 inclusive. A single `allowed` question returns `data: { "allowed": true }`, `data: { "allowed": false }`, or `data: { "allowed": "human" }` in the normal response envelope, with the original probability retained separately under `noulProbabilities`. The Results view shows **Violation (No) %** first and **Allowed (Yes) %** second alongside an explicit Approved, Rejected, or Human review decision, without duplicate Noul answer cards or a decision JSON block. These are the original model probabilities: violation is `(1 - p) × 100`, and allowed is `p × 100`. Expected labels remain Yes/No/Human review for accuracy scoring. The Raw JSON tab, saved outputs, and exports retain the original values and decisions. Old boolean-only runs display “Probability unavailable” rather than inventing a percentage. Any invalid or missing probability produces an error instead of partial decisions; upstream errors are preserved. Other question configurations retain their full upstream response. These are model judgments; test the policy on your own data.

Every successful new evaluation validates and retains the original probability for **every Noul question**, including mixed Noul/Choice/Score requests. Boolean-only, missing, mistyped, or out-of-range Noul answers produce an explicit provider error instead of a successful result with missing percentages. `/api/config` advertises probability support; the UI blocks new evaluations against an older server and asks you to restart it. `npm run dev` now watches backend files and restarts the server when they change. An older process started without watch mode needs a one-time restart; refreshing the frontend alone does not reload its Express routes.

Click **Load 65 example texts** to fill the batch inputs with labeled Persian/English conversation, internal versus external courses and duels, strict contact/link cases, disguised values, like/comment requests, meaningless strings, and meaningful short or technical messages. The same inputs are in `examples/advertisement-spam-texts.json`. Clicking this button replaces the current state text list. Saved outputs for common lists still go to ignored `.local/` storage.

Six additional independent common lists are available, each with one `allowed` question. The politics list has 64 examples; the profanity list has 12 examples and the respect list has 54 examples; the hate/discrimination list has 32 labeled examples and the sexual-content list has 60, and privacy has 44:

- **Iranian Politics**: rejects Iranian political content and any discussion of Iranian government bodies or departments, including routine administrative services. It also rejects current and former Iranian leaders’ names and aliases, including خمینی، خامنه‌ای، مجتبی، علی، سید علی، آقا، پهلوی, even in non-political contexts. It also rejects the Islamic Revolution and its anniversaries, the Islamic Republic, Trump, Israel, Netanyahu/Bibi, and clerics, seminaries, and related institutions. Political uses of nicknames such as کتلت and کباب are rejected; ambiguous uses require admin review, while clear food references remain allowed. Basij and the IRGC/Sepah are explicitly prohibited. References to forty (چهل/۴۰/40) require contextual caution: prohibited context is rejected, ambiguous or standalone references require admin review, and clearly ordinary uses can pass. Ordinary references to Iran and unrelated everyday topics remain allowed when none of these restrictions apply.
- **Persian & English Profanity**: rejects recognizable Persian/English profanity, including Finglish, disguised forms, and explicit quoted profanity. Neutral medical language and ordinary words with similar letters remain allowed.
- **Disrespect & Violence**: rejects direct/indirect disrespect, personal attacks, insulting sarcasm, recognizable profanity even without a target, threats, wishes of harm, encouragement or justification of violence, requests to harm someone, and graphic violence. Persian, Finglish, English, and recognizable censored or obfuscated forms are covered. Explicit insults and profanity also fail when quoted or presented as jokes or educational examples. Respectful criticism, firm boundaries, neutral non-graphic reports without repeating insults/profanity, violence prevention, and fully unreadable redactions remain allowed. This list combines these checks in one `allowed` answer.
- **Hate Speech & Discrimination** (Hate speech & discrimination): rejects identity-based attacks, dehumanization, and discriminatory exclusion. Neutral identity references, criticism of ideas, and reporting or condemning discrimination remain allowed.
- **Inappropriate Sexual Content** (Inappropriate sexual content): rejects explicit sexual content, pornography requests, sexual harassment, exploitation, and nonconsensual sexual content. It also rejects standalone lustful reactions such as جووون/joooon and recognizable stretched or obfuscated variants under this app’s policy; clear nonsexual uses, names, ordinary affection, and neutral harassment reports remain allowed. Neutral health education, consent discussions, and non-explicit abuse reports remain allowed.
- **Privacy & Personal Information** (Privacy violations): rejects any personal information, phone number, email, precise address/location, personal profile, identifiable financial/medical data, credentials, or private content, plus requests to obtain or disclose them. Self-sharing, consent, public business contacts, quotations, and synthetic contact values are not exceptions. Recoverable obfuscation also fails. General discussion, fully redacted reports, broad city/country names, ordinary numbers, and non-personal links remain allowed. Suggestions for in-app user search and ordinary follow navigation without personal details are allowed. Finding and sharing one’s own registration referral code is distinct from credentials and is allowed without personal data. Requests to extract personal details and login/recovery codes remain prohibited. Human review is reserved for genuinely missing material, not missing consent. Contact values in examples are fictional.

Each list evaluates only its own policy. Select a list and use its **Load example texts** button to try ordinary cases, difficult cases, and attempts to override the instructions. Each of the three newer lists includes 20 extra difficult examples (10 Persian and 10 English), covering indirect discrimination, quotations and counterspeech, educational versus erotic requests, harassment, obfuscated wording, consent scope and withdrawal, previously leaked private data, prompt injection, and missing context requiring human review. Refresh the page to discover newly added common lists. No external API call is needed to load them.

The app ships seven independent Common lists with English names, each containing one `allowed` question. All are loaded globally from `common/question-lists/`, saved in Git, and editable through **Save shared changes**. The former seven-policy combined Common list and its import dataset have been removed. Select the individual lists you need; multiple selection can still evaluate them together without creating a bundled combined list.

### Local lists

Under Questions, enter a **List name** and click **Save locally**. Lists are stored as JSON files in `.local/question-lists/` inside the project, which is ignored by Git. Choose a saved list to replace the question editor with its questions. **Save changes** updates the selected list; choose **New list** to save a separate copy of the current questions. Saved lists remain available after restarting the app.

**Export JSON** downloads the current questions, and **Import JSON** loads a file into the editor. Imports are validated before replacing the current list; click **Save locally** after importing to keep the list in this project. Both operations preserve structured instructions and typed criteria. State, provider settings, and API keys are excluded.

The exported format is `{ "version": 1, "name": "My questions", "questions": { ... } }`. Import also accepts a bare API question map or a request object containing `questions`. Files must be smaller than 1 MB. Saving and exporting questions works even if the state input is unfinished or invalid.

## Batch text tests and saved outputs

Every input, in Single mode or Text list → Text fields, has compact **Expected per question** rows for dataset labeling. Each row shows the question name and instructions beside its selector, using that question's criteria descriptions and options. Select **Yes**, **No**, or **Human review** for Noul, an option for Choice, or a level for Score; Box accepts a JSON object with `top`, `bottom`, `left`, and `right` fractions. Leave unknown answers at **—**. Yes and No serialize as `true`/`false`; Human review serializes as `"human"`. Human review can be a manual reference label or an automatic decision when the original Yes/allowed probability is between 30% and 90%, inclusive. Both are excluded from automatic accuracy; resolving a reference label does not override an automatic human-review decision. Labels belong to the question's name, type, instructions, and criteria: different policy lists that reuse `allowed` keep separate labels while editing, and returning to an unchanged question restores its label. All question lists use these fields. Labels are local metadata and are never sent to the model.

The startup and reset examples, all seven common question lists, and the sample text JSON files now include editable reference answers. Common lists store `exampleTexts` as objects with both `text` and `expectedAnswers` in each array item. **Load example texts** appears below the list actions for any selected list with examples, including local copies, and opens this labeled JSON array directly. Lists without examples show a disabled button and an explanatory message. Matching bundled examples are available even if an older running server omits them from its response. If you have edited the questions, reload the source list before loading its examples so labels cannot be silently dropped or applied to different definitions. Changing a shared question clears its old example labels when saving. These reference labels are authored examples, rather than provider-generated ground truth. **Load red circle example** and **Load blue square example** load the bundled picture, neutral state, image questions, and known shape/color labels together. Arbitrary uploaded images are not labeled automatically.

After editing expected answers for an existing completed run, **Apply current labels · reuse answers** recalculates comparisons without a provider call, provided the questions and input states still match. Relabeling a saved run creates an unsaved copy for saving or exporting; the original history file remains intact.

**Export dataset JSON** saves the text list and labels before a run. **Import texts JSON** accepts labeled items such as `{"texts":[{"text":"Example","expectedAnswers":{"allowed":false}}]}` as well as the existing plain-text formats. Choose the matching question list when importing; exported datasets include its question definitions for reference. Array view and exports always use `{ "text": "…", "expectedAnswers": { … } }` objects, keeping labels visibly attached when rows move; unlabeled inputs have an empty `expectedAnswers` object. Replacing an object with a plain string removes its labels. Saved outputs and output exports preserve each input's labels and display them beside its results. If questions change, incompatible labels must be cleared or corrected. Unsaved labels reset on page reload; export the dataset or save a completed run to retain them.

Every finished request displays **Request token usage** with **Input**, **Output**, and **Total** counts. The **Total usage · this run** panel above the results sums the displayed run and updates as requests finish, including text, image, and boolean moderation evaluations. Saved/reopened runs and JSON exports retain per-request usage. Older saved runs also work when usage is inside the original provider data.

Labeled runs also show **Dataset accuracy**, a per-question accuracy table, and compact **Expected vs model** rows marking each answer **Correct**, **Wrong**, **Human review**, **Unlabeled**, **Pending**, or **Not scored**. Accuracy is correct divided by scored labeled answers, pooled across the displayed run. Each question has its own denominator. Coverage shows scored/total labels; human review, missing or invalid answers, failures, skipped inputs, and pending requests are excluded, never silently counted as correct or wrong. With no scored labels, accuracy is **—**. **Inputs with all labels correct** separately measures fully scored inputs where every supplied label matches; questions left unlabeled do not affect that metric.

All Noul questions in every list use the same original, unrounded Yes/allowed probability: above 90% means Approved (`true`), below 30% means Rejected (`false`), and 30% through 90%, including both boundaries, means Human review (`"human"`). Decisions use the Yes/allowed probability, not its complement or an answer confidence field. Choice, Score, and Box retain their own typed scoring rules. Legacy boolean-only responses retain their original decision and show probability unavailable. Reopened history with original probabilities is re-evaluated using the current three-way rule. Choice compares option names exactly. Score rounds to the nearest integer level (ties round up); imported fractional expected scores instead compare the original numeric score within `1e-9`. Box compares intersection-over-union at `>= 0.5` (identical zero-area boxes match exactly). **Scoring rules** in the output explains these defaults. Metrics update as requests finish and use the run's captured questions and labels, including reopened history. Saved runs and output exports include recomputed comparisons, counts, accuracy, and rules under `evaluation`; labels and metrics never enter the provider request.

Totals use provider-reported counts; when both input and output counts are available, their sum supplies a missing total. Missing counts display `—`, with coverage and a **Partial totals** notice when some finished requests do not report usage. Failed requests count when the provider supplies usage; skipped requests do not count. The summary covers the current run, not lifetime account usage.

Choose **Text list** in the State panel and add one or more texts. Each text is sent as a separate `{ "text": "…" }` state with the same questions. Requests run sequentially, and each result appears in its own numbered output card. Errors are retained per text and the queue continues. **Cancel remaining texts** stops waiting for the active request and skips queued texts; requests already received by the provider may still finish and be billed.

Use **List style → Text fields** for individual inputs, or **Array [ ]** to edit the same list as `["Text one", "Text two"]`. Both views preserve text order, Unicode, whitespace, and line breaks. Invalid JSON drafts remain in the array editor and block evaluation until corrected; switching back to text fields requires valid array syntax.

In **Text list** mode, use **Test range → From / To** to run an inclusive range of text numbers (for example, 1–100 tests the first 100 texts). Blank bounds default to the first/last text; **All texts** clears the range. The full dataset stays loaded and exports include all texts. Only selected texts and their reference labels enter the run. Invalid ranges block testing. Importing a dataset, loading examples, or resetting clears the range.

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

Dataset reference labels that do not match the selected question names, types, or scoped policy definitions no longer block evaluation. A warning appears before running and in the output. Model answers remain visible; mismatched input labels are retained as unscored reference data in saved/exported outputs, without copying a general `allowed` label across multiple policies. Matching per-question labels still receive normal accuracy scoring.
