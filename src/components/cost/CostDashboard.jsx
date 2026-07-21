import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie,
} from 'recharts';
import { AlertTriangle } from 'lucide-react';

const CHART_COLORS = ['#22d3ee', '#10b981', '#a855f7', '#f59e0b', '#ec4899', '#3b82f6'];

export default function CostDashboard({ runLogs = [], budgetLimit = 1.0, currentSessionCost = 0 }) {
  const agentCostMap = {};
  const modelCostMap = {};

  runLogs.forEach((log) => {
    const name = log.agentName || 'Unknown Agent';
    const model = log.model || 'gpt-5.6-terra';
    const tokens = log.totalTokens || 0;
    const cost = log.cost || (tokens / 1000000) * 2.50;

    if (!agentCostMap[name]) {
      agentCostMap[name] = { name, tokens: 0, cost: 0 };
    }
    agentCostMap[name].tokens += tokens;
    agentCostMap[name].cost += cost;

    if (!modelCostMap[model]) {
      modelCostMap[model] = { name: model, value: 0 };
    }
    modelCostMap[model].value += tokens;
  });

  const agentData = Object.values(agentCostMap);
  const modelData = Object.values(modelCostMap);

  const totalTokens = runLogs.reduce((sum, l) => sum + (l.totalTokens || 0), 0);

  const budgetUsagePercent = Math.min(100, (currentSessionCost / budgetLimit) * 100);
  const isWarning = budgetUsagePercent >= 80;
  const isDanger = budgetUsagePercent >= 95;

  const chartTooltipStyle = {
    background: '#0f172a',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '6px',
    fontSize: '12px',
    color: '#e2e8f0',
  };

  return (
    <div className="bg-surface border-t border-border px-4 py-3 text-foreground flex flex-col gap-3 max-h-64 overflow-y-auto">
      <div className="flex items-center justify-between gap-4 pb-2.5 border-b border-border">
        <div className="flex items-center gap-5">
          <div>
            <span className="text-[11px] text-muted-foreground block">Session Cost</span>
            <span className="text-base font-mono font-semibold text-success">
              ${currentSessionCost.toFixed(5)}
            </span>
          </div>

          <div>
            <span className="text-[11px] text-muted-foreground block">Tokens</span>
            <span className="text-base font-mono font-semibold text-primary">
              {totalTokens.toLocaleString()}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 bg-background/50 px-3 py-1.5 rounded-md border border-border">
          <div className="w-28 bg-border rounded-full h-1.5 overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                isDanger ? 'bg-danger' : isWarning ? 'bg-warning' : 'bg-primary'
              }`}
              style={{ width: `${budgetUsagePercent}%` }}
            />
          </div>
          <span className="text-[11px] font-mono text-muted-foreground">
            {budgetUsagePercent.toFixed(1)}%
          </span>

          {isWarning && (
            <div className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-medium ${
              isDanger ? 'bg-danger/10 text-danger border border-danger/20' : 'bg-warning/10 text-warning border border-warning/20'
            }`}>
              <AlertTriangle className="w-3 h-3" />
              {isDanger ? 'LIMIT' : 'WARN'}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="h-32 bg-background/50 p-2 rounded-md border border-border flex flex-col">
          <span className="text-[10px] text-muted-foreground font-medium mb-1 uppercase tracking-wider">Tokens per Agent</span>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={agentData}>
              <XAxis dataKey="name" stroke="#64748b" fontSize={9} tickLine={false} axisLine={false} />
              <YAxis stroke="#64748b" fontSize={9} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={chartTooltipStyle} />
              <Bar dataKey="tokens" fill="#22d3ee" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="h-32 bg-background/50 p-2 rounded-md border border-border flex flex-col items-center justify-center">
          <span className="text-[10px] text-muted-foreground font-medium mb-1 self-start uppercase tracking-wider">Model Share</span>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={modelData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={32}
                innerRadius={12}
              >
                {modelData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={chartTooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="h-32 bg-background/50 p-2 rounded-md border border-border overflow-y-auto">
          <span className="text-[10px] text-muted-foreground font-medium mb-1 block uppercase tracking-wider">Breakdown</span>
          <table className="w-full text-left text-[11px]">
            <thead>
              <tr className="text-muted-foreground border-b border-border">
                <th className="pb-0.5 font-medium">Agent</th>
                <th className="pb-0.5 text-right font-medium">Tokens</th>
                <th className="pb-0.5 text-right font-medium">Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50 font-mono">
              {agentData.map((row) => (
                <tr key={row.name} className="text-muted-foreground">
                  <td className="py-0.5 font-sans truncate max-w-[88px] text-foreground">{row.name}</td>
                  <td className="py-0.5 text-right text-primary">{row.tokens}</td>
                  <td className="py-0.5 text-right text-success">${row.cost.toFixed(5)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
