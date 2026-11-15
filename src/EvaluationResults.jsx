const percentage = value => value === null ? '—' : `${(value * 100).toFixed(1)}%`;
const display = (value, type) => value === undefined || value === null ? '—' : type === 'noul' ? value === 'human' ? 'Human review' : value === true ? 'Yes' : 'No' : typeof value === 'object' ? JSON.stringify(value) : String(value);
const statusLabels = { correct: 'Correct', wrong: 'Wrong', unlabeled: 'Unlabeled', pending: 'Pending', unavailable: 'Not scored', review: 'Human review' };

export function AccuracySummary({ evaluation }) {
  const { summary, perQuestion, inputs } = evaluation;
  return <section className="accuracy-summary" aria-label="Dataset accuracy">
    <div className="accuracy-heading"><strong>Dataset accuracy</strong><span>{percentage(summary.accuracy)}</span></div>
    {!summary.labeled ? <p className="field-hint">Add expected answers before running to measure accuracy.</p> : <>
      <p className="accuracy-counts"><span>{summary.correct} correct</span><span>{summary.wrong} wrong</span><span>{summary.scored}/{summary.labeled} labels scored</span>{summary.review > 0 && <span>{summary.review} human review</span>}</p>
      {(summary.pending > 0 || summary.unavailable > 0 || summary.review > 0) && <p className="accuracy-coverage">Partial results · {summary.pending} pending · {summary.unavailable} unavailable · {summary.review} human review. Unscored labels are excluded.</p>}
      <div className="evaluation-table-scroll"><table className="accuracy-table"><caption>Accuracy per question</caption><thead><tr><th scope="col">Question</th><th scope="col">Correct / scored</th><th scope="col">Accuracy</th></tr></thead><tbody>{Object.entries(perQuestion).map(([name, count]) => <tr key={name}><th scope="row">{name}</th><td>{count.correct} / {count.scored}{count.labeled > count.scored && <small>{count.labeled - count.scored} unscored</small>}</td><td>{percentage(count.accuracy)}</td></tr>)}</tbody></table></div>
      <p className="input-accuracy">Inputs with all labels correct: <strong>{percentage(inputs.accuracy)}</strong> · {inputs.correct}/{inputs.scored} fully scored labeled inputs</p>
    </>}
    <details className="comparison-rules"><summary>Scoring rules</summary><p>Dataset accuracy = correct ÷ scored labeled answers across all inputs. Unlabeled, pending, failed, skipped, missing, and human-review answers are excluded. Yes/No percentages show the model probability, not accuracy. Human review is your manual label; no review range is applied. Resolve it to Yes or No and apply current labels to score existing results. Scores use the nearest level; fractional expected scores require an exact numeric match. Yes/no uses probability ≥ 0.5. Choices match exactly. Boxes require intersection-over-union ≥ 50%. Metrics use this run’s saved questions and labels.</p></details>
  </section>;
}

export function AnswerComparisons({ evaluation, index }) {
  if (!evaluation || (!evaluation.labeled && !Object.values(evaluation.comparisons).some(item => item.type === 'noul'))) return null;
  return <section className="answer-comparisons" aria-label={`Answer comparison for input ${index + 1}`}>
    <div className="evaluation-table-scroll"><table><caption>Expected vs model · {evaluation.correct}/{evaluation.scored} correct</caption><thead><tr><th scope="col">Question</th><th scope="col">Expected</th><th scope="col">Model</th><th scope="col">Result</th></tr></thead><tbody>{Object.entries(evaluation.comparisons).map(([name, comparison]) => <tr key={name} className={`comparison-${comparison.status}`}><th scope="row">{name}</th><td>{display(comparison.expected, comparison.type)}</td><td>{display(comparison.predicted, comparison.type)}{comparison.probability !== undefined ? <small className="yes-no-percentages"><span>Yes {percentage(comparison.probability)}</span><span>No {percentage(1 - comparison.probability)}</span></small> : comparison.type === 'noul' && comparison.predicted !== null && <small>Probability unavailable</small>}{comparison.score !== undefined && comparison.score !== comparison.predicted && <small>score {comparison.score.toFixed(3)}</small>}{comparison.iou !== undefined && <small>IoU {percentage(comparison.iou)}</small>}</td><td><span className={`comparison-badge ${comparison.status}`} title={comparison.reason}>{statusLabels[comparison.status]}</span>{comparison.reason && <small>{comparison.reason}</small>}</td></tr>)}</tbody></table></div>
  </section>;
}
