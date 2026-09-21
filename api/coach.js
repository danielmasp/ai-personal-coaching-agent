const ACTION_TYPES = new Set(["progress_summary", "goal_adjustment", "pattern_alert"]);

function json(res, status, body) {
  res.status(status).setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

function validateAction(value) {
  if (!value || !ACTION_TYPES.has(value.type) || typeof value.message !== "string") return null;
  return {
    type: value.type,
    title: String(value.title || "Coaching insight").slice(0, 80),
    message: value.message.slice(0, 600),
    payload: value.payload && typeof value.payload === "object" ? value.payload : {},
  };
}

function fallbackAction(context) {
  const goal = context?.goals?.[0];
  if (!goal) {
    return {
      type: "goal_adjustment",
      title: "Start with one signal",
      message: "Create one measurable weekly goal, then log the smallest useful activity toward it.",
      payload: { suggestedTarget: 3 },
    };
  }
  return {
    type: "progress_summary",
    title: "Weekly progress",
    message: `${goal.title} is ${goal.progressPercent}% complete this week (${goal.completedThisWeek} of ${goal.target} ${goal.unit}).`,
    payload: { goalId: goal.id, progressPercent: goal.progressPercent },
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });
  const { message, context } = req.body || {};
  if (typeof message !== "string" || !message.trim() || !context) {
    return json(res, 400, { error: "Message and bounded context are required" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return json(res, 200, { action: fallbackAction(context), mode: "local" });

  const system = `You are a concise personal coach. Use only the supplied context. Return valid JSON with this schema: {"type":"progress_summary|goal_adjustment|pattern_alert","title":"short title","message":"specific response","payload":{}}. Never claim access to data outside the context.`;
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514",
      max_tokens: 500,
      system,
      messages: [{ role: "user", content: JSON.stringify({ message: message.slice(0, 500), context }) }],
    }),
  });

  if (!response.ok) return json(res, 502, { error: "Reasoning provider unavailable" });
  const result = await response.json();
  const raw = result.content?.find((block) => block.type === "text")?.text || "";
  let parsed;
  try {
    parsed = JSON.parse(raw.replace(/^```json\s*|\s*```$/g, ""));
  } catch {
    return json(res, 502, { error: "Invalid structured response" });
  }
  const action = validateAction(parsed);
  if (!action) return json(res, 502, { error: "Unsupported coaching action" });
  return json(res, 200, { action, mode: "claude" });
}
