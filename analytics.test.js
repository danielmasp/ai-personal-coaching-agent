import test from "node:test";
import assert from "node:assert/strict";
import { dateKey, daysSinceLastEntry, startOfWeek, trendForGoal, weeklyProgress } from "./src/lib/analytics.js";

const goal = { id: "focus", title: "Deep work", target: 10, unit: "hours" };
const reference = new Date("2026-09-23T12:00:00Z");

test("startOfWeek returns Monday in UTC", () => {
  assert.equal(startOfWeek(reference).toISOString(), "2026-09-21T00:00:00.000Z");
});

test("dateKey uses the calendar date in the user's local timezone", () => {
  const localDate = new Date(2026, 8, 21, 23, 30);
  assert.equal(dateKey(localDate), "2026-09-21");
});

test("weeklyProgress includes only matching current-week entries", () => {
  const entries = [
    { goalId: "focus", date: "2026-09-21", value: 2 },
    { goalId: "focus", date: "2026-09-22", value: 3 },
    { goalId: "other", date: "2026-09-22", value: 9 },
    { goalId: "focus", date: "2026-09-14", value: 8 },
  ];
  assert.deepEqual(weeklyProgress(entries, goal, reference), {
    completed: 5,
    target: 10,
    percentage: 50,
    entries: entries.slice(0, 2),
  });
});

test("trendForGoal compares current and previous weeks", () => {
  const entries = [
    { goalId: "focus", date: "2026-09-21", value: 6 },
    { goalId: "focus", date: "2026-09-14", value: 4 },
  ];
  assert.deepEqual(trendForGoal(entries, goal, reference), { direction: "up", percentage: 50 });
});

test("daysSinceLastEntry returns the latest matching gap", () => {
  const entries = [
    { goalId: "focus", date: "2026-09-20", value: 1 },
    { goalId: "focus", date: "2026-09-18", value: 1 },
  ];
  assert.equal(daysSinceLastEntry(entries, "focus", reference), 3);
});
