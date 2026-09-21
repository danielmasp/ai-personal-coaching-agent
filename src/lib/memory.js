const STORAGE_KEY = "northstar-coach-memory-v1";

export const EMPTY_MEMORY = Object.freeze({
  profile: { name: "", coachingStyle: "direct and supportive" },
  goals: [],
  entries: [],
  messages: [],
});

function freshMemory() {
  return JSON.parse(JSON.stringify(EMPTY_MEMORY));
}

export function normalizeMemory(value) {
  const fallback = freshMemory();
  if (!value || typeof value !== "object") return fallback;
  return {
    profile: {
      name: typeof value.profile?.name === "string" ? value.profile.name.slice(0, 60) : "",
      coachingStyle: typeof value.profile?.coachingStyle === "string"
        ? value.profile.coachingStyle.slice(0, 120)
        : fallback.profile.coachingStyle,
    },
    goals: Array.isArray(value.goals) ? value.goals.filter((goal) => goal?.id && goal?.title) : [],
    entries: Array.isArray(value.entries) ? value.entries.filter((entry) => entry?.goalId && entry?.date) : [],
    messages: Array.isArray(value.messages) ? value.messages.slice(-50) : [],
  };
}

export function loadMemory() {
  try {
    return normalizeMemory(JSON.parse(localStorage.getItem(STORAGE_KEY)));
  } catch {
    return freshMemory();
  }
}

export function saveMemory(memory) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeMemory(memory)));
}

export function clearMemory() {
  localStorage.removeItem(STORAGE_KEY);
  return freshMemory();
}
