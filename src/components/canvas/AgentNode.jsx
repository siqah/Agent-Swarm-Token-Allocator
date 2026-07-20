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

const PROVIDER_COLORS = {
  openai: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400', badge: 'bg-emerald-500/20 text-emerald-300' },
  anthropic: { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-400', badge: 'bg-amber-500/20 text-amber-300' },
  google: { bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-400', badge: 'bg-blue-500/20 text-blue-300' },
  groq: { bg: 'bg-purple-500/10', border: 'border-purple-500/30', text: 'text-purple-400', badge: 'bg-purple-500/20 text-purple-300' },
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
  const colorTheme = PROVIDER_COLORS[provider] || PROVIDER_COLORS.openai;

  const status = data.status || 'idle';

  return (
    <div
      className={`relative min-w-[220px] rounded-xl border p-4 shadow-lg backdrop-blur-md transition-all duration-200 ${
        selected ? 'border-cyan-400 ring-2 ring-cyan-400/20 shadow-cyan-500/10' : colorTheme.border
      } bg-slate-900/90 text-slate-100 hover:border-slate-500`}
    >
      {/* Input Handle */}
      <Handle
        type="target"
        position={Position.Top}
        className="!h-3 !w-3 !bg-cyan-400 !border-2 !border-slate-900 hover:scale-125 transition-transform"
      />

      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className={`p-2 rounded-lg ${colorTheme.bg} ${colorTheme.text}`}>
          <IconComponent className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold truncate text-slate-100 leading-tight">
            {data.name || 'Agent'}
          </h3>
          <span className="text-[10px] text-slate-400 font-mono block">
            T: {data.temperature ?? 0.7}
          </span>
        </div>

        {/* Status Indicator */}
        {status === 'running' && <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />}
        {status === 'completed' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
        {status === 'failed' && <XCircle className="w-4 h-4 text-rose-400" />}
        {status === 'pending' && <Clock className="w-4 h-4 text-amber-400 animate-pulse" />}
      </div>

      {/* System Prompt snippet */}
      {data.systemPrompt && (
        <p className="text-[11px] text-slate-400 line-clamp-2 mb-3 font-sans leading-relaxed bg-slate-950/50 p-1.5 rounded border border-slate-800/60">
          {data.systemPrompt}
        </p>
      )}

      {/* Footer / Badges */}
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-800/60 text-[10px]">
        <span className={`px-2 py-0.5 rounded font-mono font-medium ${colorTheme.badge}`}>
          {data.model || 'gpt-5.6-terra'}
        </span>
        {data.tokens > 0 && (
          <span className="text-slate-400 font-mono">
            {data.tokens} tk
          </span>
        )}
      </div>

      {/* Output Handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!h-3 !w-3 !bg-cyan-400 !border-2 !border-slate-900 hover:scale-125 transition-transform"
      />
    </div>
  );
}

export default memo(AgentNode);
