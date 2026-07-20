import React from 'react';
import { X, Trash2, Sliders, Cpu, MessageSquare } from 'lucide-react';

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
    <aside className="w-80 bg-slate-900 border-l border-slate-800 flex flex-col h-full overflow-hidden shadow-2xl animate-fade-in">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-cyan-400" />
          <h2 className="text-sm font-semibold text-slate-200">
            Agent Configuration
          </h2>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-200 p-1 rounded hover:bg-slate-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Agent Name */}
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">
            Agent Name
          </label>
          <input
            type="text"
            value={data.name || ''}
            onChange={(e) => handleChange('name', e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500 transition-colors"
            placeholder="e.g. Code Reviewer"
          />
        </div>

        {/* Model Selection */}
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1 flex items-center gap-1">
            <Cpu className="w-3.5 h-3.5 text-cyan-400" />
            LLM Model Choice
          </label>
          <select
            value={data.model || 'gpt-5.6-terra'}
            onChange={(e) => handleChange('model', e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500 transition-colors"
          >
            {AVAILABLE_MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                [{m.provider}] {m.name}
              </option>
            ))}
          </select>
        </div>

        {/* Temperature Slider */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-medium text-slate-400">
              Temperature
            </label>
            <span className="text-xs font-mono text-cyan-400">
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
            className="w-full accent-cyan-400 bg-slate-950 rounded-lg h-1.5 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-500 mt-1">
            <span>Precise (0.0)</span>
            <span>Creative (1.0)</span>
          </div>
        </div>

        {/* System Prompt */}
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1 flex items-center gap-1">
            <MessageSquare className="w-3.5 h-3.5 text-cyan-400" />
            System Instructions / Prompt
          </label>
          <textarea
            rows={5}
            value={data.systemPrompt || ''}
            onChange={(e) => handleChange('systemPrompt', e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-slate-100 font-mono leading-relaxed focus:outline-none focus:border-cyan-500 transition-colors resize-none"
            placeholder="Define instructions for this agent..."
          />
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-slate-800">
        <button
          onClick={() => onDeleteNode(selectedNode.id)}
          className="w-full flex items-center justify-center gap-2 bg-rose-500/10 border border-rose-500/30 hover:bg-rose-500/20 text-rose-400 py-2 rounded-lg text-xs font-medium transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          Delete Agent Node
        </button>
      </div>
    </aside>
  );
}
