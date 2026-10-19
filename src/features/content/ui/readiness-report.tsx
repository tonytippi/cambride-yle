type Readiness = {
  engines: { engine: string; covered: boolean; gaps: string[] }[];
  coverage: {
    engine: string;
    paper: string;
    part: string;
    guidanceId: string;
    topic: string;
    taskType: string;
    topicTargetId: string | null;
    vocabularyTargetIds: string[];
    grammarTargetIds: string[];
    otherTargetIds: string[];
    estimatedDurationSeconds: number;
    mediaEligible: boolean;
    composition?: { questionIds: string[]; durationSeconds: number; primaryTargetIds: string[] };
    gaps: string[];
  }[];
};

const labels = (ids: string[], targetLabels: Map<string, string>) => ids.length ? ids.map((id) => targetLabels.get(id) ?? id).join(", ") : "None";

export function ReadinessReport({ readiness, targetLabels }: { readiness: Readiness; targetLabels: Map<string, string> }) {
  return <div className="account-list">
    {readiness.engines.map((engine) => {
      const items = readiness.coverage.filter((item) => item.engine === engine.engine);
      if (!items.length) return <article className="account-card" key={engine.engine}><h3>{engine.engine}</h3><p>Gap: {engine.gaps.join(", ")}</p></article>;
      return items.map((item) => <article className="account-card" key={`${item.engine}-${item.paper}-${item.part}-${item.guidanceId}-${item.topicTargetId ?? "none"}`}>
        <h3>{item.engine}</h3>
        <p>{item.paper.replace("_", " ")} Part {item.part} · {item.estimatedDurationSeconds} candidate seconds</p>
        <p>Topic/task type: {item.topic} · {item.taskType}</p>
        <p>Selected topic: {item.topicTargetId ? targetLabels.get(item.topicTargetId) ?? item.topicTargetId : "None selected"}</p>
        <p>Vocabulary targets: {labels(item.vocabularyTargetIds, targetLabels)} · Grammar targets: {labels(item.grammarTargetIds, targetLabels)}{item.otherTargetIds.length ? ` · Other targets: ${labels(item.otherTargetIds, targetLabels)}` : ""}</p>
        <p>{item.mediaEligible ? "Essential media eligible" : "Essential media gap"}</p>
        {item.composition ? <p>Composition proven: {item.composition.durationSeconds} seconds, {item.composition.primaryTargetIds.length} primary objective(s), question versions {item.composition.questionIds.join(", ")}.</p> : <p>Composition gap: {item.gaps.join(", ")}.</p>}
        {item.composition && item.gaps.length ? <p>Coverage gap: {item.gaps.join(", ")}.</p> : null}
      </article>);
    })}
  </div>;
}
