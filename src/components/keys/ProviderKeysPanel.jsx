import React, { useState, useEffect } from 'react';
import { Key, X, Check, Eye, EyeOff, Loader2, Copy, Terminal } from 'lucide-react';

const PROVIDERS = [
  { name: 'openai', label: 'OpenAI', placeholder: 'sk-proj-...' },
  { name: 'anthropic', label: 'Anthropic', placeholder: 'sk-ant-...' },
  { name: 'google', label: 'Google', placeholder: 'AIza...' },
  { name: 'groq', label: 'Groq', placeholder: 'gsk_...' },
];

export default function ProviderKeysPanel({ embedded }) {
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState(null);
  const [keys, setKeys] = useState({});
  const [showKeys, setShowKeys] = useState({});
  const [loading, setLoading] = useState({});
  const [statuses, setStatuses] = useState({});
  const [swarmKey, setSwarmKey] = useState(null);
  const [copied, setCopied] = useState(false);

  const shouldFetch = embedded || open;

  useEffect(() => {
    if (!shouldFetch) return;
    setSwarmKey(null);
    fetch('/api/init')
      .then(r => r.json())
      .then(d => setToken(d.token))
      .catch(() => {});
  }, [shouldFetch]);

  useEffect(() => {
    if (!token) return;
    PROVIDERS.forEach(async (name) => {
      try {
        const res = await fetch('/api/providers', { headers: { 'Authorization': `Bearer ${token}` } });
        if (res.ok) {
          const data = await res.json();
          const p = data.providers?.find(pv => pv.name === name);
          if (p) setStatuses(prev => ({ ...prev, [name]: p }));
        }
      } catch {}
    });
  }, [token]);

  const generateSwarmKey = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/keys/generate', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'VS Code' }),
      });
      if (res.ok) { const d = await res.json(); setSwarmKey(d.key); }
    } catch {}
  };

  const refreshStatus = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/providers', { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        const next = {};
        data.providers?.forEach(p => { next[p.name] = p; });
        setStatuses(next);
      }
    } catch {}
  };

  const addKey = async (name, key) => {
    if (!key.trim() || !token) return;
    setLoading(prev => ({ ...prev, [name]: true }));
    try {
      const res = await fetch(`/api/providers/${name}/keys`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: key.trim() }),
      });
      if (res.ok) {
        setKeys(prev => ({ ...prev, [name]: '' }));
        await refreshStatus();
        generateSwarmKey();
      } else {
        const err = await res.json();
        alert(err.error?.message || 'Failed to add key');
      }
    } catch {}
    setLoading(prev => ({ ...prev, [name]: false }));
  };

  const removeKey = async (name) => {
    if (!token) return;
    setLoading(prev => ({ ...prev, [name]: true }));
    try {
      await fetch(`/api/providers/${name}/keys/all`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
      await refreshStatus();
    } catch {}
    setLoading(prev => ({ ...prev, [name]: false }));
  };

  const copySwarmKey = () => {
    if (swarmKey) { navigator.clipboard.writeText(swarmKey); setCopied(true); setTimeout(() => setCopied(false), 2000); }
  };

  const keyCards = PROVIDERS.map(({ name, label, placeholder }) => {
    const hasKeys = statuses[name]?.keys > 0 || statuses[name]?.available;
    return (
      <div key={name} className="bg-elevated rounded-lg p-3 border border-border">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-foreground capitalize">{label}</span>
          <span className={`text-[11px] font-medium px-2 py-0.5 rounded ${hasKeys ? 'text-success bg-success/10' : 'text-muted-foreground bg-hover'}`}>
            {hasKeys ? 'Active' : 'No key'}
          </span>
        </div>
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <input type={showKeys[name] ? 'text' : 'password'} placeholder={placeholder}
              value={keys[name] || ''} onChange={(e) => setKeys(prev => ({ ...prev, [name]: e.target.value }))}
              className="w-full bg-background border border-border rounded-md px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/50 pr-8"
            />
            <button onClick={() => setShowKeys(prev => ({ ...prev, [name]: !prev[name] }))}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showKeys[name] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>
          {hasKeys ? (
            <button onClick={() => removeKey(name)} disabled={loading[name]}
              className="px-2.5 py-1.5 rounded-md text-xs font-medium bg-danger/10 text-danger hover:bg-danger/20 disabled:opacity-40"
            >{loading[name] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Remove'}</button>
          ) : (
            <button onClick={() => addKey(name, keys[name] || '')} disabled={loading[name] || !keys[name]?.trim()}
              className="px-2.5 py-1.5 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:brightness-110 disabled:opacity-40"
            >{loading[name] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}</button>
          )}
        </div>
      </div>
    );
  });

  const swarmKeySection = swarmKey && (
    <div className="p-3 rounded-lg border border-primary/20 bg-primary/5">
      <div className="flex items-center gap-2 mb-2">
        <Terminal className="w-3.5 h-3.5 text-primary" />
        <span className="text-xs font-semibold text-foreground">VS Code Swarm Key</span>
      </div>
      <div className="flex gap-2">
        <code className="flex-1 bg-background border border-border rounded-md px-2.5 py-1.5 text-xs font-mono text-primary break-all select-all">{swarmKey}</code>
        <button onClick={copySwarmKey}
          className="px-2.5 py-1.5 rounded-md text-xs font-medium bg-elevated border border-border text-foreground hover:bg-hover"
        >{copied ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}</button>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        Paste in VS Code (Cline, Continue, Cursor) as API key with endpoint <code className="text-foreground">http://localhost:3001/v1</code>
      </p>
    </div>
  );

  if (embedded) return (
    <div className="w-full max-w-lg">
      <h2 className="text-base font-semibold text-foreground mb-4">Provider API Keys</h2>
      <div className="space-y-3">{keyCards}</div>
      {swarmKeySection}
      <p className="mt-4 text-[11px] text-muted-foreground">Keys are encrypted at rest. No restart needed.</p>
    </div>
  );

  return (
    <>
      <button onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 bg-elevated hover:bg-hover text-foreground border border-border px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors"
      ><Key className="w-3.5 h-3.5" /> Keys</button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-surface border border-border rounded-xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Key className="w-4 h-4" /> Provider API Keys
              </div>
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-4 space-y-3">{keyCards}</div>
            {swarmKeySection && <div className="px-4 pb-4">{swarmKeySection}</div>}
            <div className="px-4 py-2.5 border-t border-border bg-elevated/50">
              <p className="text-[11px] text-muted-foreground">Keys are encrypted at rest. No restart needed.</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
