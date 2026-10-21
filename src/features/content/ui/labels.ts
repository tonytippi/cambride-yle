/* Staff-facing labels for internal content metadata. */
export const engineLabels: Record<string, string> = {
  picture_true_false: "Picture true/false",
  picture_yes_no: "Picture yes/no",
  audio_picture_choice: "Listen and choose a picture",
  audio_note_taking: "Listen and write",
  word_bank_cloze: "Word bank gap fill",
};
export const statusLabels: Record<string, string> = { draft: "Draft", in_review: "In review", approved: "Approved", published: "Published", retired: "Retired" };
export const paperLabel = (paper: string, part: string | number) => `${paper === "listening" ? "Listening" : "Reading and Writing"} Part ${part}`;
export const engineLabel = (engine: string) => engineLabels[engine] ?? engine;
export const statusLabel = (status: string) => statusLabels[status] ?? status;
export const minutes = (seconds: number) => {
  const whole = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest ? `${whole} min ${rest} s` : `${whole} min`;
};
/* The next step each status needs, shown as the primary action in the library. */
export const nextStepLabels: Record<string, string> = {
  draft: "Validate, then submit for review",
  in_review: "Approve or reject",
  approved: "Publish",
  published: "Live for learners",
  retired: "Kept as history",
};
