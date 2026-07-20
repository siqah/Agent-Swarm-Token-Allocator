import React, { useState } from 'react';
import { Terminal, CheckCircle2, XCircle, Loader2, Clock, ChevronDown, ChevronRight, Copy, Check } from 'lucide-react';

export default function RunInspector({ runState, runLogs, isRunning }) {
  const [expandedLogId, setExpandedLogId] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  const handleCopy = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const toggleExpand = (id) => {
    setExpandedLogId((prev) => (prev === id ? null : id));
  };

  return (
    <aside className="w-96 bg-slate-900 border-l border-slate-800 flex flex-col h-full overflow-hidden shadow-2xl animate-fade-in">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-cyan-400" />
          <h2 className="text-sm font-semibold text-slate-200">Run Execution Inspector</h2>
        </div>
        {isRunning && (
          <span className="flex items-center gap-1.5 text-xs text-cyan-400 font-mono bg-cyan-500/10 px-2.5 py-1 rounded-full border border-cyan-500/20">
            <Loader2 className="w-3 h-3 animate-spin" />
            Executing DAG...
          </span>
        )}
      </div>

      {/* Summary Banner */}
      {runState && (
        <div className="p-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between text-xs font-mono">
          <div>
            <span className="text-slate-400">Total Tokens: </span>
            <span className="text-slate-200 font-semibold">{runState.totalTokens || 0}</span>
          </div>
          <div>
            <span className="text-slate-400">Est. Cost: </span>
            <span className="text-emerald-400 font-semibold">${(runState.totalCost || 0).toFixed(5)}</span>
          </div>
        </div>
      )}

      {/* Logs List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {(!runLogs || runLogs.length === 0) && (
          <div className="text-center py-12 text-slate-500 text-xs">
            No active or past run logs. Click "Run Workflow" to execute the agent graph.
          </div>
        )}

        {runLogs?.map((log) => {
          const isExpanded = expandedLogId === log.id;
          return (
            <div
              key={log.id || log.agentNodeId}
              className="rounded-lg border border-slate-800 bg-slate-950/70 overflow-hidden text-xs transition-colors hover:border-slate-700"
            >
              {/* Log Header */}
              <div
                onClick={() => toggleExpand(log.id)}
                className="flex items-center justify-between p-3 cursor-pointer hover:bg-slate-800/40 select-none"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {log.status === 'running' && <Loader2 className="w-4 h-4 text-cyan-400 animate-spin shrink-0" />}
                  {log.status === 'completed' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
                  {log.status === 'failed' && <XCircle className="w-4 h-4 text-rose-400 shrink-0" />}
                  {log.status === 'pending' && <Clock className="w-4 h-4 text-amber-400 animate-pulse shrink-0" />}

                  <span className="font-medium text-slate-200 truncate">{log.agentName}</span>
                </div>

                <div className="flex items-center gap-2 shrink-0 font-mono text-[11px] text-slate-400">
                  {log.totalTokens > 0 && <span>{log.totalTokens} tk</span>}
                  {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                </div>
              </div>

              {/* Expanded Details */}
              {isExpanded && (
                <div className="p-3 border-t border-slate-800/80 bg-slate-950 space-y-2 font-mono text-[11px]">
                  <div className="flex justify-between text-slate-400 border-b border-slate-900 pb-1">
                    <span>Model: {log.model || 'N/A'}</span>
                    <span>In: {log.inputTokens || 0} / Out: {log.outputTokens || 0}</span>
                  </div>

                  {log.responseText && (
                    <div className="relative group">
                      <div className="flex items-center justify-between mb-1 text-slate-400">
                        <span>Response Output:</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopy(log.responseText, log.id);
                          }}
                          className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-200"
                        >
                          {copiedId === log.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          {copiedId === log.id ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                      <pre className="p-2 rounded bg-slate-900 border border-slate-800 text-slate-300 whitespace-pre-wrap max-h-48 overflow-y-auto leading-relaxed">
                        {log.responseText}
                      </pre>
                    </div>
                  )}

                  {log.errorMessage && (
                    <div className="p-2 rounded bg-rose-500/10 border border-rose-500/30 text-rose-400 whitespace-pre-wrap">
                      Error: {log.errorMessage}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
