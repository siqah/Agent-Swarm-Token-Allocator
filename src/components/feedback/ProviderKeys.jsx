import { useState, useEffect, useCallback } from 'react';
import styles from './ProviderKeys.module.css';

const PROVIDER_INFO = {
  openai:    { label: 'OpenAI',     color: '#00A67E' },
  anthropic: { label: 'Anthropic',  color: '#D4A574' },
  google:    { label: 'Google AI',  color: '#4285F4' },
  groq:      { label: 'Groq',       color: '#F97316' },
};

export default function ProviderKeys() {
  const [providers, setProviders] = useState([]);
  const [ctrlToken, setCtrlToken] = useState(null);
  const [keyInputs, setKeyInputs] = useState({});
  const [adding, setAdding] = useState({});
  const [removing, setRemoving] = useState({});
  const [message, setMessage] = useState(null);

  useEffect(() => {
    fetch('/api/init').then(r => r.json()).then(d => {
      if (d.token) setCtrlToken(d.token);
    }).catch(() => {});
  }, []);

  const fetchProviders = useCallback(async () => {
    if (!ctrlToken) return;
    try {
      const res = await fetch('/api/providers', {
        headers: { Authorization: `Bearer ${ctrlToken}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setProviders(data.providers || []);
    } catch {}
  }, [ctrlToken]);

  useEffect(() => {
    fetchProviders();
  }, [fetchProviders]);

  useEffect(() => {
    if (!ctrlToken) return;
    const interval = setInterval(fetchProviders, 5000);
    return () => clearInterval(interval);
  }, [ctrlToken, fetchProviders]);

  const showMessage = (text, type = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleAddKey = async (name) => {
    const key = keyInputs[name]?.trim();
    if (!key) return;
    setAdding(prev => ({ ...prev, [name]: true }));
    try {
      const res = await fetch(`/api/providers/${name}/keys`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ctrlToken}`,
        },
        body: JSON.stringify({ key }),
      });
      const data = await res.json();
      if (!res.ok) {
        showMessage(data.error?.message || 'Failed to add key', 'error');
      } else {
        showMessage(`${PROVIDER_INFO[name]?.label || name} key added`);
        setKeyInputs(prev => ({ ...prev, [name]: '' }));
        fetchProviders();
      }
    } catch {
      showMessage('Failed to connect to server', 'error');
    } finally {
      setAdding(prev => ({ ...prev, [name]: false }));
    }
  };

  const handleRemoveKey = async (name) => {
    setRemoving(prev => ({ ...prev, [name]: true }));
    try {
      const res = await fetch(`/api/providers/${name}/keys/all`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${ctrlToken}` },
      });
      const data = await res.json();
      if (!res.ok) {
        showMessage(data.error?.message || 'Failed to remove key', 'error');
      } else {
        showMessage(`${PROVIDER_INFO[name]?.label || name} key removed`);
        fetchProviders();
      }
    } catch {
      showMessage('Failed to connect to server', 'error');
    } finally {
      setRemoving(prev => ({ ...prev, [name]: false }));
    }
  };

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.title}>Provider API Keys</span>
        <span className={styles.subtitle}>Add LLM provider keys to enable real calls</span>
      </div>

      {message && (
        <div className={`${styles.message} ${message.type === 'error' ? styles.messageError : styles.messageSuccess}`}>
          {message.text}
        </div>
      )}

      <div className={styles.providerList}>
        {Object.entries(PROVIDER_INFO).map(([name, info]) => {
          const p = providers.find(p => p.name === name);
          const hasKeys = (p?.keyCount || 0) > 0;

          return (
            <div key={name} className={styles.providerRow}>
              <div className={styles.providerHeader}>
                <div className={styles.providerNameRow}>
                  <span
                    className={styles.statusDot}
                    style={{ background: hasKeys ? info.color : 'var(--text-muted)' }}
                  />
                  <span className={styles.providerName}>{info.label}</span>
                  {hasKeys && (
                    <span className={styles.keyBadge}>{p.keyCount} key{p.keyCount > 1 ? 's' : ''}</span>
                  )}
                </div>
                {hasKeys && (
                  <button
                    className={styles.removeBtn}
                    onClick={() => handleRemoveKey(name)}
                    disabled={removing[name]}
                  >
                    {removing[name] ? '...' : 'Remove'}
                  </button>
                )}
              </div>

              {!hasKeys && (
                <div className={styles.addRow}>
                  <input
                    className={styles.keyInput}
                    type="password"
                    placeholder="sk-..."
                    value={keyInputs[name] || ''}
                    onChange={e => setKeyInputs(prev => ({ ...prev, [name]: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && handleAddKey(name)}
                  />
                  <button
                    className={styles.addBtn}
                    onClick={() => handleAddKey(name)}
                    disabled={adding[name] || !keyInputs[name]?.trim()}
                  >
                    {adding[name] ? 'Adding...' : 'Add Key'}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
