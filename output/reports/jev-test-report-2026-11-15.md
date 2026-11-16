# Jev testing, token usage and cost report

As of 15 November 2026 | Timezone: Asia/Tehran

## Summary

- Recorded live requests: 73; successful: 73.
- Input tokens: 271,929; output: 4,803; total: 276,732.
- Provider-reported charges: $0.002397500 for 33 requests.
- Estimated charges: $0.009032016 for 40 requests.
- Recorded-plus-estimated total: **$0.011429516**, approximately 1.143 US cents. This is not a reconciled invoice.
- Fresh software verification: 46/46 automated tests passed; production build passed. These checks use mocked providers and incur no Jev API charges.

## Run inventory and costs

| Run | Requests | Input tokens | Output tokens | Total tokens | Recorded USD | Estimated USD |
|---|---:|---:|---:|---:|---:|---:|
| Legacy spam and contact checks | 11 | 12,221 | 1,023 | 13,244 | $0.000516500 | - |
| Legacy combined, single allowed check | 20 | 42,591 | 400 | 42,991 | $0.001793500 | - |
| Image shape and color checks | 2 | 2,069 | 140 | 2,209 | $0.000087500 | - |
| Four-policy labeled moderation | 40 | 215,048 | 3,240 | 218,288 | - | $0.009032016 |

## Model test findings

- The latest saved labeled live run evaluated 40 texts against four policies: advertising/spam, Iran politics, profanity, and respect.
- Accuracy on scored labels: **156/156 (100%)**. Four human-review labels are excluded, so 156/160 labels (97.5%) were scored.
- Each policy scored 39/39 correct, with one manual-review label. Of 40 inputs, 36 were fully scored and correct; four retain one manual-review label each.
- The earlier 11-text spam/contact run and 20-text single-allowed run have no saved reference labels. Their HTTP success is verified; their accuracy is not measurable from the saved records.
- Image check: 2/2 passed; red circle returned red with 99% circle probability; blue square returned blue with 1% circle probability. Box localization was not tested.
- The 100% figure is agreement with bundled reference examples for the saved prompt snapshot, not evidence of production accuracy or probability calibration.

### Manual-review model probabilities

| Text | Policy | Violation (No) | Allowed (Yes) |
|---|---|---:|---:|
| 37 | advertising_spam_allowed | 78.0% | 22.0% |
| 38 | iran_politics_allowed | 24.0% | 76.0% |
| 39 | profanity_allowed | 6.0% | 94.0% |
| 40 | respect_allowed | 8.0% | 92.0% |

## Current three-policy expansion

- Hate/discrimination, inappropriate sexual content, and privacy each contain 32 labeled examples, including 20 added difficult examples (10 Persian and 10 English).
- The combined list contains seven independent questions and 121 texts. All 60 new difficult examples are included.
- No saved live evaluation exists for the three new policies or the current seven-question/121-text combined dataset. Model accuracy and usage for that expansion remain unmeasured.
- Current example counts describe the authored dataset; they are not counts of completed live API calls.

## Price calculation

Reference pricing verified on 15 November 2026: [TypeSafe Jev pricing](https://help.typesafe.ai/articles/5187202169-how-much-does-jev-cost) lists $0.042 per million input tokens and free output tokens.

`Estimated USD = input tokens / 1,000,000 × 0.042 + output tokens / 1,000,000 × 0`

Latest four-policy run: 215,048 / 1,000,000 × 0.042 = $0.009032016.
All-token baseline at this rate: $0.011421018. This is a comparison, not added to the selected total.
Preferred total = recorded provider charges $0.002397500 + missing-charge estimate $0.009032016 = $0.011429516.
- Small differences between recorded provider charges and the token-rate baseline are retained, not overwritten. Response metadata does not establish whether the difference is rounding or another provider billing rule.
- Charges are USD. No unverified toman exchange rate, subscription cost, tax, fee or Codex/chat cost has been added.

## Audit trail and limits

- Canonical saved run files and the standalone image-check response file were counted once. The byte-equivalent entry data in the latest checkpoint and its derived summary/report were excluded.
- The ledger has one row per recorded API request, not one row per policy decision. It includes original token counts, available provider charges, estimates, source paths and latency.
- Only saved local records are covered. Unsaved, deleted, interrupted or externally billed calls may be absent. Token usage was present for all 73 included requests; direct charge metadata was present for 33.
- All historical results were evaluated against the questions and labels saved with that run, not relabeled using today's seven-policy definitions.

### Source files (SHA-256)

- .local/question-lists/89a42172-28b6-48dc-b63a-545e45fce988.runs/d37e3b85-2256-4c5b-9202-3ebc73a0838f.json
  - SHA-256: 405d0d26f97bdf0278945364135cc7584373a66279f495f337331b572c666627
- .local/question-lists/b5d81d1a-398e-4e8c-a041-62c3e7cb9075.runs/49e45f84-b966-4786-bd1c-305ac3449f06.json
  - SHA-256: abe1989458f22e6ff0c855b1a1681edec289f5d3de875f29f668e540c19ea45b
- .local/question-lists/b5d81d1a-398e-4e8c-a041-62c3e7cb9075.runs/f4232c90-9f9f-4364-ab50-83e0516689a0.json
  - SHA-256: 62cd962069ef7600fd9b876e9a7c781fa0885b4639a12ddbcbaa7335bb4e10f8
- .local/gapgpt-image-check.json
  - SHA-256: 0b1acd72c2ac30c62b3ab8afbb06bf2729f1afe95d4473cf6bcd998f9c943752

### Run timestamps

- Legacy spam and contact checks: 14/11/2026, 14:08:19 to 14/11/2026, 14:08:28 (Asia/Tehran); ID: d37e3b85-2256-4c5b-9202-3ebc73a0838f.
- Legacy combined, single allowed check: 14/11/2026, 15:39:56 to 14/11/2026, 15:40:18 (Asia/Tehran); ID: 49e45f84-b966-4786-bd1c-305ac3449f06.
- Image shape and color checks: start not saved to 14/11/2026, 16:44:05 (Asia/Tehran); ID: image-check-2026-11-14.
- Four-policy labeled moderation: 15/11/2026, 10:30:40 to 15/11/2026, 10:31:16 (Asia/Tehran); ID: f4232c90-9f9f-4364-ab50-83e0516689a0.
