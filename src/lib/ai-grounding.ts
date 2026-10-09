export type StudySource = { id: string; title: string; content: string };
export function selectExcerpts(sources: StudySource[], question: string) {
  const terms = new Set(
    question.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) || [],
  );
  return sources
    .map((source) => {
      const blocks = source.content
        .split(/\n\s*\n|(?<=[.!?])\s+/)
        .filter(Boolean);
      const ranked = blocks
        .map((text, index) => ({
          text,
          index,
          score: [...terms].filter((word) => text.toLowerCase().includes(word))
            .length,
        }))
        .sort((a, b) => b.score - a.score || a.index - b.index);
      const selected = ranked.filter((block) => block.score > 0).slice(0, 3);
      return {
        ...source,
        content: (selected.length ? selected : ranked.slice(0, 2))
          .map((block) => block.text)
          .join("\n")
          .slice(0, 4000),
        matched: selected.length > 0,
      };
    })
    .filter((source) => source.content.trim());
}
export function validateCitations(answer: string, count: number) {
  const matches = [...answer.matchAll(/\[(\d+)\]/g)].map((match) =>
    Number(match[1]),
  );
  return (
    matches.length > 0 && matches.every((index) => index >= 1 && index <= count)
  );
}
