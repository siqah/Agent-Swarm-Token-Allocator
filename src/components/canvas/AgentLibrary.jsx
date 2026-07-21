import React, { useMemo } from 'react';
import { AGENT_TEMPLATES } from '../../data/templates';
import { Bot, Code, FileText, ShieldCheck, Search, PenTool } from 'lucide-react';

const ICON_MAP = {
  FileText,
  Code,
  ShieldCheck,
  Search,
  PenTool,
  Bot,
};

const CATEGORY_ORDER = ['Analysis', 'Engineering', 'Evaluation', 'Research', 'Marketing', 'General'];

export default function AgentLibrary() {
  const grouped = useMemo(() => {
    const map = {};
    for (const tpl of AGENT_TEMPLATES) {
      const cat = tpl.category || 'General';
      if (!map[cat]) map[cat] = [];
      map[cat].push(tpl);
    }
    return CATEGORY_ORDER.filter((c) => map[c]).map((c) => ({ category: c, items: map[c] }));
  }, []);

  const onDragStart = (event, nodeData) => {
    event.dataTransfer.setData('application/reactflow', JSON.stringify(nodeData));
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <aside className="w-56 bg-surface border-r border-border flex flex-col h-full overflow-hidden select-none">
      <div className="p-3 border-b border-border">
        <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider">
          Agent Library
        </h2>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          Drag onto canvas
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-3">
        {grouped.map(({ category, items }) => (
          <div key={category}>
            <h3 className="text-[10px] font-semibold text-muted uppercase tracking-wider px-1 mb-1">
              {category}
            </h3>
            <div className="space-y-1">
              {items.map((tpl) => {
                const Icon = ICON_MAP[tpl.icon] || Bot;
                return (
                  <div
                    key={tpl.name}
                    draggable
                    onDragStart={(e) => onDragStart(e, tpl)}
                    className="flex items-center gap-2 px-2.5 py-2 rounded-md bg-background/50 border border-border hover:border-primary/40 hover:bg-hover/50 cursor-grab active:cursor-grabbing transition-all duration-150"
                  >
                    <div className="shrink-0 text-primary">
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-medium text-foreground truncate block">
                        {tpl.name}
                      </span>
                      <span className="text-[10px] text-muted-foreground font-mono truncate block">
                        {tpl.model}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}
