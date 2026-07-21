import React from 'react';
import { X, Trash2, Cpu, MessageSquare } from 'lucide-react';

const AVAILABLE_MODELS = [
  { id: 'gpt-5.6-sol', name: 'GPT-5.6 Sol (Flagship)', provider: 'OpenAI' },
  { id: 'gpt-5.6-terra', name: 'GPT-5.6 Terra (Balanced)', provider: 'OpenAI' },
  { id: 'gpt-5.6-luna', name: 'GPT-5.6 Luna (Fast)', provider: 'OpenAI' },
  { id: 'gpt-5.4-nano', name: 'GPT-5.4 Nano (Economy)', provider: 'OpenAI' },
  { id: 'claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', provider: 'Anthropic' },
  { id: 'claude-3.5-haiku', name: 'Claude 3.5 Haiku', provider: 'Anthropic' },
  { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', provider: 'Google' },
  { id: 'gemini-2.0-pro', name: 'Gemini 2.0 Pro', provider: 'Google' },
  { id: 'llama-3.3-70b', name: 'Llama 3.3 70B', provider: 'Groq' },
  { id: 'deepseek-r1', name: 'DeepSeek R1', provider: 'Groq' },
];

export default function AgentConfigPanel({ selectedNode, onUpdateNode, onDeleteNode, onClose }) {
  if (!selectedNode) return null;

  const data = selectedNode.data || {};

  const handleChange = (field, value) => {
    onUpdateNode(selectedNode.id, {
      ...data,
      [field]: value,
    });
  };

  return (
    <aside className="w-72 bg-surface border-l border-border flex flex-col h-full overflow-hidden animate-fade-in">
      <div className="p-3 border-b border-border flex items-center justify-between">
        <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider">
          Configure Agent
        </h2>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-hover transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        <div>
          <label className="block text-[11px] font-medium text-muted-foreground mb-1">
            Agent Name
          </label>
          <input
            type="text"
            value={data.name || ''}
            onChange={(e) => handleChange('name', e.target.value)}
            placeholder="e.g. Code Reviewer"
          />
        </div>

        <div>
          <label className="block text-[11px] font-medium text-muted-foreground mb-1 flex items-center gap-1">
            <Cpu className="w-3 h-3 text-primary" />
            Model
          </label>
          <select
            value={data.model || 'gpt-5.6-terra'}
            onChange={(e) => handleChange('model', e.target.value)}
          >
            {AVAILABLE_MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                [{m.provider}] {m.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-[11px] font-medium text-muted-foreground">
              Temperature
            </label>
            <span className="text-[11px] font-mono text-primary">
              {data.temperature ?? 0.7}
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={data.temperature ?? 0.7}
            onChange={(e) => handleChange('temperature', parseFloat(e.target.value))}
            className="w-full"
          />
          <div className="flex justify-between text-[10px] text-muted mt-0.5">
            <span>Precise</span>
            <span>Creative</span>
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-medium text-muted-foreground mb-1 flex items-center gap-1">
            <MessageSquare className="w-3 h-3 text-primary" />
            System Prompt
          </label>
          <textarea
            rows={5}
            value={data.systemPrompt || ''}
            onChange={(e) => handleChange('systemPrompt', e.target.value)}
            placeholder="Define instructions for this agent..."
          />
        </div>
      </div>

      <div className="p-3 border-t border-border">
        <button
          onClick={() => onDeleteNode(selectedNode.id)}
          className="w-full flex items-center justify-center gap-1.5 text-danger bg-danger/10 border border-danger/20 hover:bg-danger/20 py-2 rounded-md text-xs font-medium transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Delete Agent
        </button>
      </div>
    </aside>
  );
}
