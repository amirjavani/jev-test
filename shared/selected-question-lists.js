import { normalizeList } from './question-lists.js';
import { sameQuestions } from './runs.js';
import { examplesForList } from './question-examples.js';

// Use the same mapping for question definitions and their reference answers.
function selectionMapping(lists) {
  const groups = new Map();
  const mappings = lists.map(() => new Map());
  lists.forEach((list, index) => {
    for (const [id, question] of Object.entries(list.questions)) {
      if (!groups.has(id)) groups.set(id, []);
      const variants = groups.get(id);
      let variant = variants.find(item => sameQuestions(item.question, question));
      if (!variant) {
        variant = { question, source: list.name, members: [] };
        variants.push(variant);
      }
      variant.members.push(index);
    }
  });
  const questions = Object.create(null);
  const used = new Set(groups.keys());
  for (const [id, variants] of groups) {
    for (const variant of variants) {
      let name = id;
      if (variants.length > 1) {
        const base = `${variant.source} / ${id}`;
        name = base;
        let suffix = 2;
        while (used.has(name)) name = `${base} (${suffix++})`;
        used.add(name);
      }
      questions[name] = variant.question;
      for (const index of variant.members) mappings[index].set(id, name);
    }
  }
  return { questions, mappings };
}

export function combineQuestionLists(lists) {
  if (!lists.length) return null;
  if (lists.length === 1) return lists[0];
  const { questions } = selectionMapping(lists);
  return normalizeList({ name: 'Combined questions', questions });
}

export function examplesForSelectedLists(lists, bundledLists = []) {
  const { mappings } = selectionMapping(lists);
  return lists.flatMap((list, index) => examplesForList(list, bundledLists).map(example => ({
    ...example,
    expectedAnswers: Object.fromEntries(Object.entries(example.expectedAnswers).map(([id, answer]) => [mappings[index].get(id), answer])),
  })));
}
