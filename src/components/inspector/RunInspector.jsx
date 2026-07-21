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
    <aside className="w-80 bg-surface border-l border-border flex flex-col h-full overflow-hidden">
      <div className="p-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Terminal className="w-3.5 h-3.5 text-primary" />
          <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider">Run Inspector</h2>
        </div>
        {isRunning && (
          <span className="flex items-center gap-1 text-[10px] text-primary font-mono bg-primary/10 px-2 py-0.5 rounded border border-primary/20">
            <Loader2 className="w-2.5 h-2.5 animate-spin" />
            Running
          </span>
        )}
      </div>

      {runState && (
        <div className="px-3 py-2 bg-background/50 border-b border-border flex items-center justify-between text-[11px] font-mono">
          <div>
            <span className="text-muted-foreground">Tokens: </span>
            <span className="text-foreground font-semibold">{runState.totalTokens || 0}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Cost: </span>
            <span className="text-success font-semibold">${(runState.totalCost || 0).toFixed(5)}</span>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {(!runLogs || runLogs.length === 0) && (
          <div className="text-center py-12 text-muted-foreground text-xs">
            {isRunning ? (
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="w-5 h-5 text-primary animate-spin" />
                <span>Executing workflow...</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1">
                <Terminal className="w-5 h-5 text-muted" />
                <span>No run logs yet.</span>
                <span className="text-muted mt-0.5">Click "Run" to execute the agent graph.</span>
              </div>
            )}
          </div>
        )}

        {runLogs?.map((log) => {
          const isExpanded = expandedLogId === log.id;
          return (
            <div
              key={log.id || log.agentNodeId}
              className="rounded-md border border-border bg-background/30 overflow-hidden text-xs transition-colors hover:border-foreground/20"
            >
              <div
                onClick={() => toggleExpand(log.id)}
                className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-hover/30 select-none"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {log.status === 'running' && <Loader2 className="w-3.5 h-3.5 text-primary animate-spin shrink-0" />}
                  {log.status === 'completed' && <CheckCircle2 className="w-3.5 h-3.5 text-success shrink-0" />}
                  {log.status === 'failed' && <XCircle className="w-3.5 h-3.5 text-danger shrink-0" />}
                  {log.status === 'pending' && <Clock className="w-3.5 h-3.5 text-warning animate-pulse-subtle shrink-0" />}

                  <span className="font-medium text-foreground truncate">{log.agentName}</span>
                </div>

                <div className="flex items-center gap-2 shrink-0 font-mono text-[10px] text-muted-foreground">
                  {log.totalTokens > 0 && <span>{log.totalTokens} tk</span>}
                  {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                </div>
              </div>

              {isExpanded && (
                <div className="px-3 py-2 border-t border-border bg-background/50 space-y-2 font-mono text-[10px]">
                  <div className="flex justify-between text-muted-foreground pb-1 border-b border-border/50">
                    <span>{log.model || 'N/A'}</span>
                    <span>In: {log.inputTokens || 0} / Out: {log.outputTokens || 0}</span>
                  </div>

                  {log.responseText && (
                    <div className="relative group">
                      <div className="flex items-center justify-between mb-1 text-muted-foreground">
                        <span className="text-[10px]">Response:</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopy(log.responseText, log.id);
                          }}
                          className="flex items-center gap-1 text-[9px] text-muted-foreground hover:text-foreground"
                        >
                          {copiedId === log.id ? <Check className="w-2.5 h-2.5 text-success" /> : <Copy className="w-2.5 h-2.5" />}
                          {copiedId === log.id ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                      <pre className="p-2 rounded bg-background border border-border text-muted-foreground whitespace-pre-wrap max-h-40 overflow-y-auto leading-relaxed text-[10px]">
                        {log.responseText}
                      </pre>
                    </div>
                  )}

                  {log.errorMessage && (
                    <div className="p-1.5 rounded bg-danger/10 border border-danger/20 text-danger text-[10px]">
                      {log.errorMessage}
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
