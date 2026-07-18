import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '32px 16px',
          textAlign: 'center',
          fontFamily: 'var(--font-mono)',
          fontSize: '11px',
          color: 'var(--text-muted)',
          background: 'var(--bg-deep)',
          border: '1px solid color-mix(in srgb, var(--color-danger) 20%, transparent)',
          borderRadius: 'var(--radius-md)',
          margin: 'var(--space-2)',
        }}>
          <span style={{ fontSize: '20px', marginBottom: '8px', color: 'var(--color-danger)' }}>!</span>
          <span style={{ marginBottom: '4px' }}>Panel crashed</span>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)', maxWidth: 240 }}>
            {this.state.error?.message}
          </span>
        </div>
      );
    }
    return this.props.children;
  }
}
