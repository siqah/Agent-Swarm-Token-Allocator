import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Bot, Code, FileText, ShieldCheck, Search, PenTool, Loader2, CheckCircle2, XCircle, Clock } from 'lucide-react';

const ICON_MAP = {
  FileText,
  Code,
  ShieldCheck,
  Search,
  PenTool,
  Bot,
};

const PROVIDER_STYLES = {
  openai: { icon: 'text-emerald-400', badge: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' },
  anthropic: { icon: 'text-amber-400', badge: 'bg-amber-500/10 text-amber-300 border-amber-500/20' },
  google: { icon: 'text-blue-400', badge: 'bg-blue-500/10 text-blue-300 border-blue-500/20' },
  groq: { icon: 'text-purple-400', badge: 'bg-purple-500/10 text-purple-300 border-purple-500/20' },
};

function getProvider(modelName = '') {
  if (modelName.startsWith('gpt-') || modelName.startsWith('o1-') || modelName.startsWith('o3-')) return 'openai';
  if (modelName.startsWith('claude')) return 'anthropic';
  if (modelName.startsWith('gemini')) return 'google';
  if (modelName.startsWith('llama') || modelName.startsWith('mixtral') || modelName.startsWith('deepseek')) return 'groq';
  return 'openai';
}

function AgentNode({ data, selected }) {
  const IconComponent = ICON_MAP[data.icon] || Bot;
  const provider = getProvider(data.model);
  const theme = PROVIDER_STYLES[provider] || PROVIDER_STYLES.openai;
  const status = data.status || 'idle';

  return (
    <div
      className={`relative min-w-[200px] rounded-lg border bg-elevated/90 text-foreground transition-all duration-200 ${
        selected
          ? 'border-primary ring-1 ring-primary/20'
          : 'border-border hover:border-foreground/20'
      }`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!h-2.5 !w-2.5 !bg-primary !border-2 !border-background hover:scale-125 transition-transform"
      />

      <div className="p-3">
        <div className="flex items-center gap-2.5 mb-2">
          <div className={`${theme.icon}`}>
            <IconComponent className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold truncate leading-tight">
              {data.name || 'Agent'}
            </h3>
            <span className="text-[10px] text-muted-foreground font-mono">
              T: {data.temperature ?? 0.7}
            </span>
          </div>

          {status === 'running' && <Loader2 className="w-3.5 h-3.5 text-primary animate-spin shrink-0" />}
          {status === 'completed' && <CheckCircle2 className="w-3.5 h-3.5 text-success shrink-0" />}
          {status === 'failed' && <XCircle className="w-3.5 h-3.5 text-danger shrink-0" />}
          {status === 'pending' && <Clock className="w-3.5 h-3.5 text-warning animate-pulse-subtle shrink-0" />}
        </div>

        {data.systemPrompt && (
          <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed mb-2 bg-background/50 p-2 rounded border border-border">
            {data.systemPrompt}
          </p>
        )}

        <div className="flex items-center justify-between pt-1.5 border-t border-border">
          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${theme.badge}`}>
            {data.model || 'gpt-5.6-terra'}
          </span>
          {data.tokens > 0 && (
            <span className="text-[10px] text-muted-foreground font-mono">
              {data.tokens} tk
            </span>
          )}
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!h-2.5 !w-2.5 !bg-primary !border-2 !border-background hover:scale-125 transition-transform"
      />
    </div>
  );
}

export default memo(AgentNode);
