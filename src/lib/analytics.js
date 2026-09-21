const DAY_MS = 24 * 60 * 60 * 1000;

export function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function startOfWeek(reference = new Date()) {
  const date = new Date(reference);
  date.setUTCHours(0, 0, 0, 0);
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - day + 1);
  return date;
}

export function weeklyProgress(entries, goal, reference = new Date()) {
  const start = startOfWeek(reference);
  const end = new Date(start.getTime() + 7 * DAY_MS);
  const relevant = entries.filter((entry) => {
    const date = new Date(`${entry.date}T12:00:00Z`);
    return entry.goalId === goal.id && date >= start && date < end;
  });
  const completed = relevant.reduce((sum, entry) => sum + Number(entry.value || 0), 0);
  const target = Number(goal.target || 0);
  const percentage = target > 0 ? Math.min(100, Math.round((completed / target) * 100)) : 0;

  return { completed, target, percentage, entries: relevant };
}

export function trendForGoal(entries, goal, reference = new Date()) {
  const current = weeklyProgress(entries, goal, reference).completed;
  const previousReference = new Date(reference.getTime() - 7 * DAY_MS);
  const previous = weeklyProgress(entries, goal, previousReference).completed;
  if (!previous) return { direction: "new", percentage: null };
  const percentage = Math.round(((current - previous) / previous) * 100);
  return { direction: percentage >= 0 ? "up" : "down", percentage: Math.abs(percentage) };
}

export function daysSinceLastEntry(entries, goalId, reference = new Date()) {
  const matching = entries
    .filter((entry) => entry.goalId === goalId)
    .sort((a, b) => b.date.localeCompare(a.date));
  if (!matching.length) return null;
  const last = new Date(`${matching[0].date}T12:00:00Z`);
  return Math.max(0, Math.floor((reference - last) / DAY_MS));
}
