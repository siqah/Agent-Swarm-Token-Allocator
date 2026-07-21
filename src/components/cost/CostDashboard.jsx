import React from 'react';
import { AlertTriangle, Activity } from 'lucide-react';

const AGENT_COLORS = ['#22d3ee', '#a855f7', '#10b981', '#f59e0b'];

function getAgentName(agentId, departments) {
  for (const dept of departments || []) {
    const agent = (dept.agents || []).find(a => a.id === agentId);
    if (agent) return agent.name;
  }
  return agentId;
}

export default function CostDashboard({ runLogs = [], budgetLimit = 1.0, currentSessionCost = 0, liveUsage = {}, simulating = false, departments = [] }) {
  let agentMap = {};

  if (simulating && Object.keys(liveUsage).length > 0) {
    const usage = Object.entries(liveUsage);
    usage.forEach(([agentId, u]) => {
      const name = getAgentName(agentId, departments);
      agentMap[name] = { name, tokens: u.total, cost: (u.total / 1000000) * 2.50 };
    });
  }

  if (!simulating || Object.keys(liveUsage).length === 0) {
    runLogs.forEach((log) => {
      const name = log.agentName || 'Unknown';
      const tokens = log.totalTokens || 0;
      const cost = log.cost || (tokens / 1000000) * 2.50;
      if (!agentMap[name]) agentMap[name] = { name, tokens: 0, cost: 0 };
      agentMap[name].tokens += tokens;
      agentMap[name].cost += cost;
    });
  }

  const agentData = Object.values(agentMap);
  const totalTokens = agentData.reduce((s, a) => s + a.tokens, 0);
  const budgetPct = Math.min(100, (currentSessionCost / budgetLimit) * 100);
  const isWarning = budgetPct >= 80;
  const isDanger = budgetPct >= 95;
  const maxAgentTokens = Math.max(...agentData.map(a => a.tokens), 1);
  const hasData = agentData.length > 0;

  return (
    <div className="flex-1 overflow-y-auto bg-background text-foreground">
      <div className="px-4 py-2.5 flex items-center justify-between border-b border-border">
        <div className="flex items-center gap-4">
          <div>
            <span className="text-[10px] text-muted-foreground">Session Cost</span>
            <span className="text-sm font-mono font-semibold text-success ml-1.5">
              ${currentSessionCost.toFixed(5)}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-muted-foreground">Tokens</span>
            <span className="text-sm font-mono font-semibold text-primary ml-1.5">
              {totalTokens.toLocaleString()}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {simulating && <Activity className="w-3 h-3 text-success animate-pulse" />}
          <div className="w-20 bg-border rounded-full h-1.5 overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                isDanger ? 'bg-danger' : isWarning ? 'bg-warning' : 'bg-primary'
              }`}
              style={{ width: `${budgetPct}%` }}
            />
          </div>
          <span className="text-[10px] font-mono text-muted-foreground">{budgetPct.toFixed(0)}%</span>
          {isWarning && (
            <AlertTriangle className={`w-3 h-3 ${isDanger ? 'text-danger' : 'text-warning'}`} />
          )}
        </div>
      </div>

      <div className="p-4">
        {!hasData && !simulating && (
          <div className="text-[11px] text-muted-foreground text-center py-6">
            Run a workflow or click Simulate to see token consumption
          </div>
        )}

        {!hasData && simulating && (
          <div className="text-[11px] text-muted-foreground text-center py-6">
            Simulation running — waiting for token usage...
          </div>
        )}

        {hasData && (
          <div className="flex items-start gap-0">
            <div className="flex flex-col items-center shrink-0 w-16 pt-1">
              <div className="text-[10px] font-mono font-semibold text-primary">
                ${budgetLimit.toFixed(2)}
              </div>
              <div className="text-[9px] text-muted-foreground -mt-0.5">budget</div>
              <div className="mt-1.5 w-px h-6 bg-gradient-to-b from-primary to-transparent" />
              <div className="mt-0.5 text-[10px] font-mono text-success">
                ${currentSessionCost.toFixed(4)}
              </div>
              <div className="text-[9px] text-muted-foreground -mt-0.5">spent</div>
            </div>

            <div className="flex-1 ml-3 space-y-2">
              {agentData.map((agent, i) => {
                const pct = totalTokens > 0 ? (agent.tokens / totalTokens) * 100 : 0;
                const barPct = (agent.tokens / maxAgentTokens) * 100;
                const color = AGENT_COLORS[i % AGENT_COLORS.length];
                return (
                  <div key={agent.name} className="relative">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
                        <span className="text-[11px] font-medium text-foreground">{agent.name}</span>
                      </div>
                      <span className="text-[10px] font-mono text-muted-foreground">
                        {agent.tokens.toLocaleString()} tok · ${agent.cost.toFixed(5)}
                      </span>
                    </div>
                    <div className={`h-2 bg-border rounded-full overflow-hidden ${simulating ? 'animate-pulse' : ''}`}>
                      <div
                        className="h-full rounded-full transition-all duration-700 ease-out"
                        style={{ width: `${barPct}%`, backgroundColor: color }}
                      />
                    </div>
                    <div className="mt-0.5 text-[9px] font-mono text-muted-foreground text-right">
                      {pct.toFixed(0)}% of total
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
