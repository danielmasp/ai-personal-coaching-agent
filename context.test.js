import test from "node:test";
import assert from "node:assert/strict";
import { buildBoundedContext, createLocalCoachAction } from "./src/lib/context.js";

test("bounded context caps activity and message history", () => {
  const memory = {
    profile: { name: "Daniel", coachingStyle: "direct" },
    goals: [{ id: "g", title: "Practice", target: 7, unit: "sessions" }],
    entries: Array.from({ length: 20 }, (_, index) => ({ goalId: "g", date: `2026-09-${String(index + 1).padStart(2, "0")}`, value: 1 })),
    messages: Array.from({ length: 15 }, (_, index) => ({ role: "user", text: `Message ${index}` })),
  };
  const context = buildBoundedContext(memory, new Date("2026-09-21T12:00:00Z"));
  assert.equal(context.recentEntries.length, 12);
  assert.equal(context.recentMessages.length, 8);
  assert.equal(context.contextPolicy.totalEntries, 20);
});

test("local coach returns a supported structured action", () => {
  const action = createLocalCoachAction({ goals: [], recentEntries: [], recentMessages: [] });
  assert.equal(action.type, "goal_adjustment");
  assert.equal(typeof action.payload, "object");
});
