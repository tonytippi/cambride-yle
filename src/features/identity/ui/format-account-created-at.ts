export function formatAccountCreatedAt(createdAt: Date) {
  return createdAt.toLocaleDateString("en-GB", { timeZone: "UTC" });
}
