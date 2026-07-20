import React from 'react';
import { AGENT_TEMPLATES } from '../../data/templates';
import { Bot, Code, FileText, ShieldCheck, Search, PenTool, GripVertical } from 'lucide-react';

const ICON_MAP = {
  FileText,
  Code,
  ShieldCheck,
  Search,
  PenTool,
  Bot,
};

export default function AgentLibrary() {
  const onDragStart = (event, nodeData) => {
    event.dataTransfer.setData('application/reactflow', JSON.stringify(nodeData));
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col h-full overflow-hidden select-none">
      <div className="p-4 border-b border-slate-800">
        <h2 className="text-sm font-semibold text-slate-200 uppercase tracking-wider">
          Agent Library
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Drag & drop agents onto the workflow canvas
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {AGENT_TEMPLATES.map((tpl) => {
          const Icon = ICON_MAP[tpl.icon] || Bot;
          return (
            <div
              key={tpl.name}
              draggable
              onDragStart={(e) => onDragStart(e, tpl)}
              className="group flex items-start gap-3 p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 hover:border-cyan-500/50 hover:bg-slate-800/50 cursor-grab active:cursor-grabbing transition-all duration-150 shadow-sm hover:shadow-cyan-500/5"
            >
              <div className="mt-0.5 text-slate-500 group-hover:text-cyan-400 transition-colors">
                <GripVertical className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-1">
                  <Icon className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="text-xs font-medium text-slate-200 truncate">
                    {tpl.name}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 line-clamp-2 leading-tight">
                  {tpl.description}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                    {tpl.model}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
