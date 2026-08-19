type Readiness = {
  engines: { engine: string; covered: boolean; gaps: string[] }[];
  coverage: {
    questionId: string;
    engine: string;
    paper: string;
    part: string;
    topic: string;
    taskType: string;
    topicTargetIds: string[];
    vocabularyGrammarTargets: string[];
    estimatedDurationSeconds: number;
    mediaEligible: boolean;
    composition?: { questionIds: string[]; durationSeconds: number; primaryTargetIds: string[] };
    gaps: string[];
  }[];
};

export function ReadinessReport({ readiness, targetLabels }: { readiness: Readiness; targetLabels: Map<string, string> }) {
  return <div className="account-list">
    {readiness.engines.map((engine) => {
      const items = readiness.coverage.filter((item) => item.engine === engine.engine);
      if (!items.length) return <article className="account-card" key={engine.engine}><h3>{engine.engine}</h3><p>Gap: {engine.gaps.join(", ")}</p></article>;
      return items.map((item) => <article className="account-card" key={item.questionId}>
        <h3>{item.engine}</h3>
        <p>{item.paper.replace("_", " ")} Part {item.part} · {item.estimatedDurationSeconds} seconds</p>
        <p>Topic/task type: {item.topic} · {item.taskType}</p>
        <p>Topic targets: {item.topicTargetIds.map((id) => targetLabels.get(id) ?? id).join(", ")} · Vocabulary/grammar targets: {item.vocabularyGrammarTargets.map((id) => targetLabels.get(id) ?? id).join(", ")}</p>
        <p>{item.mediaEligible ? "Essential media eligible" : "Essential media gap"}</p>
        {item.composition ? <p>Composition proven: {item.composition.durationSeconds} seconds, {item.composition.primaryTargetIds.length} primary objective(s), question versions {item.composition.questionIds.join(", ")}.</p> : <p>Composition gap: {item.gaps.join(", ")}.</p>}
      </article>);
    })}
  </div>;
}
