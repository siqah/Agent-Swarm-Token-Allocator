// Keyword-based prompt classifier for routing to the best agent.
// Each department has agents with keywords that describe their expertise.

function tokenize(text) {
  return text.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(Boolean);
}

function score(promptTokens, agent) {
  const agentTokens = tokenize(`${agent.name} ${agent.description || ''}`);
  const agentSet = new Set(agentTokens);
  let matches = 0;
  for (const t of promptTokens) {
    if (agentSet.has(t)) matches++;
  }
  return matches / Math.max(agentTokens.length, 1);
}

/**
 * Pick the best agent in a department for a given prompt.
 * Returns { agentId, deptId, score } or null if no agents.
 */
export function classify(departments, prompt, deptIdFilter) {
  const candidates = [];

  for (const dept of departments) {
    if (deptIdFilter && dept.id !== deptIdFilter) continue;
    for (const agent of dept.agents) {
      if (!agent.swarmKey) continue;
      const agentTokens = tokenize(`${agent.name} ${agent.description || ''}`);
      const promptTokens = tokenize(prompt);
      const s = score(promptTokens, agent);
      candidates.push({
        agentId: agent.id,
        deptId: dept.id,
        deptName: dept.name,
        agentName: agent.name,
        score: s,
        totalTokens: agentTokens.length,
        matchedTokens: promptTokens.filter(t => new Set(agentTokens).has(t)).length,
      });
    }
  }

  if (candidates.length === 0) return null;

  // Sort by score descending
  candidates.sort((a, b) => b.score - a.score);

  return candidates[0];
}

/**
 * Classify prompt to determine the best department, then best agent.
 * Returns { deptId, agentId, score } or picks first agent of best department.
 */
export function classifyDepartment(departments, prompt) {
  const deptScores = departments.map((dept) => {
    const deptTokens = tokenize(dept.name);
    const promptTokens = tokenize(prompt);
    const agentTokens = dept.agents.flatMap((a) => tokenize(`${a.name} ${a.description || ''}`));
    const allTokens = [...deptTokens, ...agentTokens];
    const allSet = new Set(allTokens);
    let matches = 0;
    for (const t of promptTokens) {
      if (allSet.has(t)) matches++;
    }
    return { deptId: dept.id, score: matches / Math.max(allTokens.length, 1) };
  });

  deptScores.sort((a, b) => b.score - a.score);
  const bestDept = deptScores[0];

  if (!bestDept) return null;

  const bestAgent = classify(departments, prompt, bestDept.deptId);
  return bestAgent || { deptId: bestDept.deptId, agentId: null, score: 0 };
}
