import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie,
} from 'recharts';
import { DollarSign, Cpu, AlertTriangle, ShieldAlert } from 'lucide-react';

const COLORS = ['#22d3ee', '#10b981', '#a855f7', '#f59e0b', '#ec4899', '#3b82f6'];

export default function CostDashboard({ runLogs = [], budgetLimit = 1.0, currentSessionCost = 0 }) {
  // Aggregate cost/tokens per agent
  const agentCostMap = {};
  const modelCostMap = {};

  runLogs.forEach((log) => {
    const name = log.agentName || 'Unknown Agent';
    const model = log.model || 'gpt-5.6-terra';
    const tokens = log.totalTokens || 0;
    const cost = log.cost || (tokens / 1000000) * 2.50; // estimate if not present

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
  const totalCost = runLogs.reduce((sum, l) => sum + (l.cost || (l.totalTokens / 1000000) * 2.50), 0);

  const budgetUsagePercent = Math.min(100, (currentSessionCost / budgetLimit) * 100);
  const isWarning = budgetUsagePercent >= 80;
  const isDanger = budgetUsagePercent >= 95;

  return (
    <div className="bg-slate-900 border-t border-slate-800 p-4 font-sans text-slate-100 flex flex-col gap-4 max-h-72 overflow-y-auto">
      {/* Top Banner metrics & Budget Alert */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-6">
          <div>
            <span className="text-xs text-slate-400 block">Session Cost</span>
            <span className="text-lg font-mono font-bold text-emerald-400">
              ${currentSessionCost.toFixed(5)}
            </span>
          </div>

          <div>
            <span className="text-xs text-slate-400 block">Total Tokens</span>
            <span className="text-lg font-mono font-bold text-cyan-400">
              {totalTokens.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Budget Alert Banner */}
        <div className="flex items-center gap-3 bg-slate-950 px-4 py-2 rounded-lg border border-slate-800">
          <div className="w-32 bg-slate-800 rounded-full h-2 overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                isDanger ? 'bg-rose-500' : isWarning ? 'bg-amber-400' : 'bg-cyan-400'
              }`}
              style={{ width: `${budgetUsagePercent}%` }}
            />
          </div>
          <span className="text-xs font-mono text-slate-300">
            {budgetUsagePercent.toFixed(1)}% of ${budgetLimit.toFixed(2)} Limit
          </span>

          {isWarning && (
            <div className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded font-medium ${
              isDanger ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
            }`}>
              <AlertTriangle className="w-3.5 h-3.5" />
              {isDanger ? 'CRITICAL BUDGET' : '80% BUDGET WARN'}
            </div>
          )}
        </div>
      </div>

      {/* Visual Charts & Table Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
        {/* Bar Chart: Tokens per Agent */}
        <div className="h-40 bg-slate-950 p-2 rounded-lg border border-slate-800 flex flex-col">
          <span className="text-[11px] text-slate-400 font-medium mb-1">Tokens Per Agent</span>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={agentData}>
              <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} />
              <YAxis stroke="#64748b" fontSize={10} tickLine={false} />
              <Tooltip
                contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', fontSize: '12px' }}
              />
              <Bar dataKey="tokens" fill="#22d3ee" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pie Chart: Model Breakdown */}
        <div className="h-40 bg-slate-950 p-2 rounded-lg border border-slate-800 flex flex-col items-center justify-center">
          <span className="text-[11px] text-slate-400 font-medium mb-1 self-start">Model Share</span>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={modelData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={35}
                innerRadius={15}
              >
                {modelData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', fontSize: '12px' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Table: Breakdown List */}
        <div className="h-40 bg-slate-950 p-2 rounded-lg border border-slate-800 overflow-y-auto">
          <table className="w-full text-left text-[11px]">
            <thead>
              <tr className="text-slate-400 border-b border-slate-800">
                <th className="pb-1">Agent</th>
                <th className="pb-1 text-right">Tokens</th>
                <th className="pb-1 text-right">Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-900 font-mono">
              {agentData.map((row) => (
                <tr key={row.name} className="text-slate-300">
                  <td className="py-1 font-sans truncate max-w-[100px]">{row.name}</td>
                  <td className="py-1 text-right text-cyan-400">{row.tokens}</td>
                  <td className="py-1 text-right text-emerald-400">${row.cost.toFixed(5)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
