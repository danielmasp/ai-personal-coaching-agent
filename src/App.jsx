import { useMemo, useState } from "react";
import { dateKey, trendForGoal, weeklyProgress } from "./lib/analytics.js";
import { buildBoundedContext, createLocalCoachAction } from "./lib/context.js";
import { clearMemory, loadMemory, saveMemory } from "./lib/memory.js";

const ACTION_LABELS = {
  progress_summary: "Progress summary",
  goal_adjustment: "Goal adjustment",
  pattern_alert: "Pattern alert",
};

function uid(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function requestCoach(message, memory) {
  const context = buildBoundedContext(memory);
  try {
    const response = await fetch("/api/coach", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, context }),
    });
    if (!response.ok) throw new Error("Coach API unavailable");
    return await response.json();
  } catch {
    return { action: createLocalCoachAction(context), mode: "local" };
  }
}

export default function App() {
  const [memory, setMemory] = useState(loadMemory);
  const [selectedGoalId, setSelectedGoalId] = useState(memory.goals[0]?.id || "");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const selectedGoal = memory.goals.find((goal) => goal.id === selectedGoalId) || memory.goals[0];
  const progress = useMemo(
    () => selectedGoal ? weeklyProgress(memory.entries, selectedGoal) : null,
    [memory.entries, selectedGoal],
  );
  const trend = useMemo(
    () => selectedGoal ? trendForGoal(memory.entries, selectedGoal) : null,
    [memory.entries, selectedGoal],
  );
  const contextStats = buildBoundedContext(memory).contextPolicy;

  function persist(next) {
    setMemory(next);
    saveMemory(next);
  }

  function addGoal(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const goal = {
      id: uid("goal"),
      title: String(form.get("title")).trim(),
      target: Number(form.get("target")),
      unit: String(form.get("unit")).trim(),
      createdAt: new Date().toISOString(),
    };
    if (!goal.title || !goal.unit || goal.target <= 0) return;
    const next = { ...memory, goals: [...memory.goals, goal] };
    persist(next);
    setSelectedGoalId(goal.id);
    event.currentTarget.reset();
    setNotice("Goal added to persistent memory.");
  }

  function logMetric(event) {
    event.preventDefault();
    if (!selectedGoal) return;
    const form = new FormData(event.currentTarget);
    const entry = {
      id: uid("entry"),
      goalId: selectedGoal.id,
      date: String(form.get("date")),
      value: Number(form.get("value")),
      note: String(form.get("note")).trim().slice(0, 180),
    };
    if (!entry.date || entry.value <= 0) return;
    persist({ ...memory, entries: [...memory.entries, entry] });
    event.currentTarget.reset();
    setNotice("Metric logged. Weekly progress recalculated.");
  }

  async function sendMessage(event) {
    event.preventDefault();
    const text = message.trim();
    if (!text || busy) return;
    const userMessage = { id: uid("message"), role: "user", text, createdAt: new Date().toISOString() };
    const withUser = { ...memory, messages: [...memory.messages, userMessage] };
    persist(withUser);
    setMessage("");
    setBusy(true);
    const result = await requestCoach(text, withUser);
    const coachMessage = {
      id: uid("message"),
      role: "coach",
      text: result.action.message,
      action: result.action,
      mode: result.mode,
      createdAt: new Date().toISOString(),
    };
    persist({ ...withUser, messages: [...withUser.messages, coachMessage] });
    setBusy(false);
  }

  function resetAll() {
    if (!window.confirm("Delete all goals, metrics, and coaching history stored in this browser?")) return;
    const next = clearMemory();
    setMemory(next);
    setSelectedGoalId("");
    setNotice("Local coaching memory cleared.");
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top"><span>N</span>Northstar</a>
        <div className="topbar-meta"><span className="memory-dot" />Persistent memory active</div>
      </header>

      <main id="top">
        <section className="hero">
          <p className="eyebrow">Personal coaching agent</p>
          <h1>Turn reflection into<br /><em>measurable progress.</em></h1>
          <p>Northstar connects goals, activity history, and weekly metrics so every coaching response starts with context—not a blank slate.</p>
        </section>

        <section className="dashboard-grid">
          <aside className="panel goals-panel">
            <div className="panel-heading"><div><p className="eyebrow">Memory</p><h2>Your goals</h2></div><span>{memory.goals.length}</span></div>
            <div className="goal-list">
              {memory.goals.map((goal) => (
                <button key={goal.id} className={goal.id === selectedGoal?.id ? "goal-item active" : "goal-item"} onClick={() => setSelectedGoalId(goal.id)}>
                  <span>{goal.title}</span><small>{goal.target} {goal.unit} / week</small>
                </button>
              ))}
              {!memory.goals.length && <div className="empty"><strong>No goals yet</strong><span>Create one measurable weekly target.</span></div>}
            </div>
            <form className="compact-form" onSubmit={addGoal}>
              <label>Goal<input name="title" placeholder="Deep work" maxLength="60" required /></label>
              <div className="form-row">
                <label>Target<input name="target" type="number" min="1" step="0.5" placeholder="10" required /></label>
                <label>Unit<input name="unit" placeholder="hours" maxLength="24" required /></label>
              </div>
              <button className="button secondary" type="submit">Add goal</button>
            </form>
          </aside>

          <section className="main-column">
            <article className="panel progress-card">
              <div className="panel-heading">
                <div><p className="eyebrow">This week</p><h2>{selectedGoal?.title || "Weekly progress"}</h2></div>
                {trend?.percentage !== null && <span className={`trend ${trend?.direction}`}>{trend.direction === "up" ? "↑" : "↓"} {trend.percentage}%</span>}
              </div>
              {progress ? (
                <>
                  <div className="progress-number"><strong>{progress.completed}</strong><span>of {progress.target} {selectedGoal.unit}</span></div>
                  <div className="progress-track"><span style={{ width: `${progress.percentage}%` }} /></div>
                  <div className="progress-footer"><span>{progress.percentage}% complete</span><span>{progress.entries.length} logged activities</span></div>
                </>
              ) : <div className="empty progress-empty"><strong>Choose a direction</strong><span>Add a goal to activate weekly progress tracking.</span></div>}
            </article>

            <article className="panel coach-card">
              <div className="panel-heading"><div><p className="eyebrow">Coach</p><h2>Context-aware conversation</h2></div><span className="context-pill">{contextStats.includedEntries}/{contextStats.totalEntries} entries in context</span></div>
              <div className="messages" aria-live="polite">
                {!memory.messages.length && (
                  <div className="coach-intro"><span>✦</span><div><strong>What should we work through?</strong><p>I can summarize progress, flag a pattern, or help adjust a goal using your saved context.</p></div></div>
                )}
                {memory.messages.slice(-8).map((item) => (
                  <div key={item.id} className={`message ${item.role}`}>
                    {item.action && <span className={`action-tag ${item.action.type}`}>{ACTION_LABELS[item.action.type]}</span>}
                    <p>{item.text}</p>
                    {item.mode === "local" && <small>Local fallback · add an Anthropic key for model reasoning</small>}
                  </div>
                ))}
                {busy && <div className="message coach thinking">Reviewing saved context…</div>}
              </div>
              <form className="message-form" onSubmit={sendMessage}>
                <input value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Ask about your progress…" maxLength="500" />
                <button className="button primary" disabled={busy}>Send</button>
              </form>
            </article>
          </section>

          <aside className="panel log-panel">
            <div className="panel-heading"><div><p className="eyebrow">Activity</p><h2>Log a metric</h2></div></div>
            <form className="compact-form" onSubmit={logMetric}>
              <label>Goal<select name="goal" value={selectedGoal?.id || ""} onChange={(event) => setSelectedGoalId(event.target.value)} disabled={!selectedGoal}>
                {!selectedGoal && <option>No goal available</option>}
                {memory.goals.map((goal) => <option key={goal.id} value={goal.id}>{goal.title}</option>)}
              </select></label>
              <label>Date<input name="date" type="date" defaultValue={dateKey(new Date())} required /></label>
              <label>Amount<input name="value" type="number" min="0.1" step="0.1" placeholder={selectedGoal?.unit || "value"} required /></label>
              <label>Note<textarea name="note" rows="3" maxLength="180" placeholder="What helped or got in the way?" /></label>
              <button className="button primary" type="submit" disabled={!selectedGoal}>Save activity</button>
            </form>
            <div className="privacy-card"><strong>Private by default</strong><p>Goals and history stay in this browser. Only bounded context is sent to the server when the Claude API is configured.</p></div>
            <button className="text-button" onClick={resetAll}>Clear local memory</button>
          </aside>
        </section>
        <p className="notice" role="status">{notice}</p>
      </main>

      <footer><span>Northstar coaching agent</span><span>React · Vercel · Claude API</span></footer>
    </div>
  );
}
