export default function QuestionListExamples({ list, examples, error, disabled, onLoad }) {
  if (!list) return null;
  return <div className="question-list-examples">
    <button disabled={disabled || !examples.length || Boolean(error)} onClick={onLoad}>
      {examples.length ? `Load ${examples.length} example texts` : 'Load example texts'}
    </button>
    {error ? <p className="library-error" role="alert">{error}</p> : !examples.length && <p className="field-hint">No saved examples for this question list.</p>}
  </div>;
}
