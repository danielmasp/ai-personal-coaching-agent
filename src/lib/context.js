import { daysSinceLastEntry, trendForGoal, weeklyProgress } from "./analytics.js";

const MAX_RECENT_ENTRIES = 12;
const MAX_RECENT_MESSAGES = 8;

export function buildBoundedContext(memory, reference = new Date()) {
  const goals = memory.goals.map((goal) => {
    const progress = weeklyProgress(memory.entries, goal, reference);
    return {
      id: goal.id,
      title: goal.title,
      target: goal.target,
      unit: goal.unit,
      completedThisWeek: progress.completed,
      progressPercent: progress.percentage,
      trend: trendForGoal(memory.entries, goal, reference),
      daysSinceLastEntry: daysSinceLastEntry(memory.entries, goal.id, reference),
    };
  });

  return {
    profile: {
      name: memory.profile.name,
      coachingStyle: memory.profile.coachingStyle,
    },
    goals,
    recentEntries: [...memory.entries]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, MAX_RECENT_ENTRIES),
    recentMessages: memory.messages.slice(-MAX_RECENT_MESSAGES),
    contextPolicy: {
      includedEntries: Math.min(memory.entries.length, MAX_RECENT_ENTRIES),
      totalEntries: memory.entries.length,
      includedMessages: Math.min(memory.messages.length, MAX_RECENT_MESSAGES),
      totalMessages: memory.messages.length,
    },
  };
}

export function createLocalCoachAction(context) {
  const goal = context.goals[0];
  if (!goal) {
    return {
      type: "goal_adjustment",
      title: "Create a first goal",
      message: "Choose one measurable outcome for this week so progress has a clear signal.",
      payload: { suggestedTarget: 3 },
    };
  }

  if (goal.daysSinceLastEntry !== null && goal.daysSinceLastEntry >= 3) {
    return {
      type: "pattern_alert",
      title: "Tracking gap detected",
      message: `There has not been an update for ${goal.title} in ${goal.daysSinceLastEntry} days. Log a small win to restart the feedback loop.`,
      payload: { goalId: goal.id, pattern: "tracking_gap" },
    };
  }

  if (goal.progressPercent < 40) {
    return {
      type: "goal_adjustment",
      title: "Make the next step smaller",
      message: `${goal.title} is at ${goal.progressPercent}% this week. Protect one short block today before changing the weekly target.`,
      payload: { goalId: goal.id, suggestedTarget: goal.target },
    };
  }

  return {
    type: "progress_summary",
    title: "Weekly momentum",
    message: `${goal.title} is ${goal.progressPercent}% complete this week (${goal.completedThisWeek} of ${goal.target} ${goal.unit}).`,
    payload: { goalId: goal.id, progressPercent: goal.progressPercent },
  };
}
