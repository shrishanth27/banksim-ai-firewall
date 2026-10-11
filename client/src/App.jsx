import React, { useState, useEffect } from 'react';
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  ArrowRightLeft,
  Lock,
  RefreshCw,
  Terminal,
  Activity,
  CheckCircle2,
  XCircle,
  Copy,
  Info,
  Server,
  Zap,
  Sliders,
  Database
} from 'lucide-react';

export default function App() {
  // Server state
  const [health, setHealth] = useState(null);
  const [account, setAccount] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [events, setEvents] = useState([]);
  const [presets, setPresets] = useState([]);

  // Form state
  const [requestText, setRequestText] = useState('');
  const [amount, setAmount] = useState('');
  const [recipientId, setRecipientId] = useState('');
  const [memo, setMemo] = useState('');
  const [activePresetId, setActivePresetId] = useState(null);

  // Analysis & execution state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [verdict, setVerdict] = useState(null);
  const [verdictTab, setVerdictTab] = useState('summary'); // 'summary' | 'json' | 'telemetry'
  const [bottomTab, setBottomTab] = useState('ledger'); // 'ledger' | 'events' | 'architecture'

  // 2-Step Confirmation state
  const [pendingConfirmation, setPendingConfirmation] = useState(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [transferSuccess, setTransferSuccess] = useState(null);
  const [actionError, setActionError] = useState(null);

  // Load initial bank state, health, presets, events
  useEffect(() => {
    fetchHealth();
    fetchAccount();
    fetchTransactions();
    fetchPresets();
    fetchEvents();
  }, []);

  const fetchHealth = async () => {
    try {
      const res = await fetch('/api/health');
      if (res.ok) setHealth(await res.json());
    } catch (err) {
      console.error('Failed to fetch health status', err);
    }
  };

  const fetchAccount = async () => {
    try {
      const res = await fetch('/api/bank/account');
      if (res.ok) setAccount(await res.json());
    } catch (err) {
      console.error('Failed to fetch account info', err);
    }
  };

  const fetchTransactions = async () => {
    try {
      const res = await fetch('/api/bank/transactions');
      if (res.ok) setTransactions(await res.json());
    } catch (err) {
      console.error('Failed to fetch transactions', err);
    }
  };

  const fetchPresets = async () => {
    try {
      const res = await fetch('/api/presets');
      if (res.ok) setPresets(await res.json());
    } catch (err) {
      console.error('Failed to fetch presets', err);
    }
  };

  const fetchEvents = async () => {
    try {
      const res = await fetch('/api/events');
      if (res.ok) setEvents(await res.json());
    } catch (err) {
      console.error('Failed to fetch events', err);
    }
  };

  // Reset demo simulation state
  const handleReset = async () => {
    try {
      const res = await fetch('/api/bank/reset', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setAccount(data.account);
        setPendingConfirmation(null);
        setVerdict(null);
        setTransferSuccess(null);
        setActionError(null);
        fetchTransactions();
        fetchEvents();
      }
    } catch (err) {
      console.error('Failed to reset simulation', err);
    }
  };

  // Apply a preset test scenario
  const applyPreset = (preset) => {
    setActivePresetId(preset.id);
    setRequestText(preset.request);
    setAmount(preset.amount || '');
    setRecipientId(preset.recipientId || '');
    setMemo(preset.memo || '');
    setPendingConfirmation(null);
    setTransferSuccess(null);
    setActionError(null);
  };

  // Submit request to AI Firewall
  const handleAnalyze = async (e) => {
    e?.preventDefault();
    if (!requestText.trim()) return;

    setIsAnalyzing(true);
    setActionError(null);
    setTransferSuccess(null);
    setPendingConfirmation(null);

    try {
      const res = await fetch('/api/firewall/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          request: requestText,
          amount: amount || undefined,
          recipientId: recipientId || undefined,
          memo: memo || undefined
        })
      });

      const data = await res.json();
      setVerdict(data);

      // If approved transfer with token, set up 2-step confirmation
      if (data.status === 'APPROVED' && data.transaction_allowed && data.confirmation_token) {
        setPendingConfirmation({
          token: data.confirmation_token,
          amount: amount,
          recipientId: recipientId,
          memo: memo
        });
      }

      // Refresh events and account
      fetchEvents();
      fetchAccount();
    } catch (err) {
      setActionError(`Firewall connection error: ${err.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Execute secondary 2-step confirmation
  const handleConfirmTransfer = async () => {
    if (!pendingConfirmation?.token) return;

    setIsConfirming(true);
    setActionError(null);

    try {
      const res = await fetch('/api/transfer/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          confirmation_token: pendingConfirmation.token
        })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setTransferSuccess(data.transaction);
        setAccount(data.updatedAccount);
        setPendingConfirmation(null);
        fetchTransactions();
        fetchEvents();
      } else {
        setActionError(data.error || 'Transfer confirmation failed.');
      }
    } catch (err) {
      setActionError(`Failed to confirm transfer: ${err.message}`);
    } finally {
      setIsConfirming(false);
    }
  };

  // Determine risk level color & label
  const getRiskColor = (score) => {
    if (score <= 20) return { text: '#10b981', bg: 'rgba(16, 185, 129, 0.15)', border: '#10b981' };
    if (score <= 65) return { text: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)', border: '#f59e0b' };
    return { text: '#f43f5e', bg: 'rgba(244, 63, 94, 0.15)', border: '#f43f5e' };
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#070e22', color: '#f1f5f9', paddingBottom: '3rem' }}>
      {/* TOP HEADER */}
      <header
        style={{
          borderBottom: '1px solid #182c5b',
          backgroundColor: '#0a1430',
          padding: '1rem 1.5rem',
          position: 'sticky',
          top: 0,
          zIndex: 40,
          backdropFilter: 'blur(8px)'
        }}
      >
        <div style={{ maxWidth: 1400, margin: '0 auto', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
          {/* Logo & Title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 10,
                backgroundColor: '#122554',
                border: '1px solid #00e5ff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 15px rgba(0, 229, 255, 0.3)'
              }}
            >
              <Shield style={{ color: '#00e5ff' }} size={24} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <h1 style={{ fontSize: '1.25rem', fontWeight: 800, letterSpacing: '-0.02em', margin: 0, color: '#ffffff' }}>
                  BankSim <span style={{ color: '#00e5ff', fontWeight: 400 }}>AI Firewall</span>
                </h1>
                <span
                  style={{
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    padding: '2px 8px',
                    borderRadius: 999,
                    backgroundColor: 'rgba(0, 229, 255, 0.15)',
                    color: '#00e5ff',
                    border: '1px solid rgba(0, 229, 255, 0.3)'
                  }}
                >
                  Blue Team Edition
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8' }}>
                Defensive AI Security Layer & Multi-Tier FinTech Guardrails
              </p>
            </div>
          </div>

          {/* Mode Badges & Mock Account Card */}
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            {/* Mode Indicator */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '6px 12px',
                borderRadius: 8,
                backgroundColor: health?.mode === 'HYBRID_AI' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                border: `1px solid ${health?.mode === 'HYBRID_AI' ? '#10b981' : '#f59e0b'}`
              }}
              title={health?.disclosure || 'Firewall Status'}
            >
              <Activity size={16} style={{ color: health?.mode === 'HYBRID_AI' ? '#10b981' : '#f59e0b' }} />
              <div style={{ fontSize: '0.75rem' }}>
                <span style={{ fontWeight: 700, color: health?.mode === 'HYBRID_AI' ? '#10b981' : '#f59e0b' }}>
                  {health?.mode === 'HYBRID_AI' ? 'HYBRID AI ACTIVE' : 'RULE-BASED ONLY'}
                </span>
                <span style={{ color: '#94a3b8', marginLeft: 4 }}>
                  ({health?.ai_enabled ? (health.ai_provider || 'LLM') : 'Deterministic Guardrails'})
                </span>
              </div>
            </div>

            {/* Simulation Notice */}
            <div
              style={{
                fontSize: '0.7rem',
                color: '#38bdf8',
                backgroundColor: 'rgba(56, 189, 248, 0.08)',
                border: '1px solid rgba(56, 189, 248, 0.25)',
                padding: '6px 10px',
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                gap: 4
              }}
            >
              <Lock size={12} />
              <span>Mock In-Memory Bank (No Real Funds)</span>
            </div>

            {/* Account Quick Balance */}
            {account && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '4px 12px',
                  borderRadius: 8,
                  backgroundColor: '#0e1d44',
                  border: '1px solid #1e356e'
                }}
              >
                <div>
                  <div style={{ fontSize: '0.65rem', color: '#94a3b8', textTransform: 'uppercase' }}>Mock Balance</div>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: '#38bdf8' }}>{account.balanceFormatted}</div>
                </div>
                <button
                  onClick={handleReset}
                  title="Reset In-Memory State to Initial $5,000.00"
                  style={{
                    backgroundColor: 'transparent',
                    border: '1px solid #284485',
                    borderRadius: 6,
                    color: '#94a3b8',
                    padding: '4px 8px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    fontSize: '0.75rem'
                  }}
                  onMouseOver={(e) => (e.currentTarget.style.color = '#fff')}
                  onMouseOut={(e) => (e.currentTarget.style.color = '#94a3b8')}
                >
                  <RefreshCw size={12} /> Reset
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="app-container">
        {/* PRESET ATTACK & BENIGN SCENARIOS BAR */}
        <section style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <h2 style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8', margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Zap size={14} style={{ color: '#00e5ff' }} /> Quick Test Scenarios (Adversarial & Benign)
            </h2>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Select a preset to auto-populate request inputs</span>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '0.5rem'
            }}
          >
            {presets.map((preset) => {
              const isSelected = activePresetId === preset.id;
              const isAttack = preset.category !== 'BENIGN';
              return (
                <button
                  key={preset.id}
                  onClick={() => applyPreset(preset)}
                  style={{
                    backgroundColor: isSelected ? '#162b61' : '#0c1736',
                    border: isSelected ? '1px solid #00e5ff' : '1px solid #182e63',
                    borderRadius: 8,
                    padding: '0.65rem 0.75rem',
                    textAlign: 'left',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    boxShadow: isSelected ? '0 0 10px rgba(0, 229, 255, 0.2)' : 'none'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span
                      style={{
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        padding: '1px 6px',
                        borderRadius: 4,
                        backgroundColor: isAttack ? 'rgba(244, 63, 94, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                        color: isAttack ? '#f43f5e' : '#10b981'
                      }}
                    >
                      {preset.category}
                    </span>
                    <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>{preset.badge}</span>
                  </div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#f1f5f9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {preset.title}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: 2, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {preset.description}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* WORKSPACE GRID: REQUEST STUDIO & FIREWALL VERDICT */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
          {/* LEFT: REQUEST STUDIO */}
          <section
            style={{
              backgroundColor: '#0c1736',
              border: '1px solid #1a2f66',
              borderRadius: 12,
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', borderBottom: '1px solid #182e63', paddingBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Terminal size={18} style={{ color: '#00e5ff' }} />
                <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: '#ffffff' }}>
                  Transaction Request Studio
                </h3>
              </div>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Inspects Natural Language & Financial Fields</span>
            </div>

            <form onSubmit={handleAnalyze} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1 }}>
              {/* Natural Language Prompt / Request Input */}
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', marginBottom: 4 }}>
                  Natural Language Instruction / User Query <span style={{ color: '#f43f5e' }}>*</span>
                </label>
                <textarea
                  value={requestText}
                  onChange={(e) => setRequestText(e.target.value)}
                  placeholder="e.g. Please transfer $150.00 to account ACC-9021 for dinner reimbursement"
                  rows={3}
                  required
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.75rem',
                    backgroundColor: '#070f24',
                    border: '1px solid #1a2f66',
                    borderRadius: 8,
                    color: '#ffffff',
                    fontSize: '0.85rem',
                    resize: 'vertical',
                    outline: 'none',
                    fontFamily: 'inherit'
                  }}
                  onFocus={(e) => (e.target.style.borderColor = '#00e5ff')}
                  onBlur={(e) => (e.target.style.borderColor = '#1a2f66')}
                />
                <div style={{ fontSize: '0.65rem', color: '#64748b', marginTop: 2, display: 'flex', justifyContent: 'space-between' }}>
                  <span>Treated strictly as untrusted string data by AI Firewall</span>
                  <span>{requestText.length}/1500 chars</span>
                </div>
              </div>

              {/* Amount and Recipient ID side-by-side */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', marginBottom: 4 }}>
                    Amount (USD)
                  </label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#64748b', fontSize: '0.85rem' }}>$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.00"
                      style={{
                        width: '100%',
                        padding: '0.6rem 0.75rem 0.6rem 1.6rem',
                        backgroundColor: '#070f24',
                        border: '1px solid #1a2f66',
                        borderRadius: 8,
                        color: '#ffffff',
                        fontSize: '0.85rem',
                        outline: 'none'
                      }}
                      onFocus={(e) => (e.target.style.borderColor = '#00e5ff')}
                      onBlur={(e) => (e.target.style.borderColor = '#1a2f66')}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', marginBottom: 4 }}>
                    Recipient Identifier
                  </label>
                  <input
                    type="text"
                    value={recipientId}
                    onChange={(e) => setRecipientId(e.target.value)}
                    placeholder="e.g. ACC-9021"
                    style={{
                      width: '100%',
                      padding: '0.6rem 0.75rem',
                      backgroundColor: '#070f24',
                      border: '1px solid #1a2f66',
                      borderRadius: 8,
                      color: '#ffffff',
                      fontSize: '0.85rem',
                      outline: 'none'
                    }}
                    onFocus={(e) => (e.target.style.borderColor = '#00e5ff')}
                    onBlur={(e) => (e.target.style.borderColor = '#1a2f66')}
                  />
                </div>
              </div>

              {/* Transaction Memo Field (Untrusted input surface) */}
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', marginBottom: 4 }}>
                  Transaction Memo / Reference (Inspected for injections)
                </label>
                <input
                  type="text"
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  placeholder="e.g. Dinner reimbursement or project invoice"
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.75rem',
                    backgroundColor: '#070f24',
                    border: '1px solid #1a2f66',
                    borderRadius: 8,
                    color: '#ffffff',
                    fontSize: '0.85rem',
                    outline: 'none'
                  }}
                  onFocus={(e) => (e.target.style.borderColor = '#00e5ff')}
                  onBlur={(e) => (e.target.style.borderColor = '#1a2f66')}
                />
                <div style={{ fontSize: '0.65rem', color: '#64748b', marginTop: 2 }}>
                  Memos are analyzed for XSS scripts, SQL injections, and hidden override attempts.
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="submit"
                  disabled={isAnalyzing || !requestText.trim()}
                  style={{
                    flex: 1,
                    backgroundColor: isAnalyzing ? '#182e63' : '#00e5ff',
                    color: isAnalyzing ? '#94a3b8' : '#070e22',
                    border: 'none',
                    borderRadius: 8,
                    padding: '0.75rem 1rem',
                    fontWeight: 700,
                    fontSize: '0.9rem',
                    cursor: isAnalyzing ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    transition: 'all 0.15s ease',
                    boxShadow: '0 0 15px rgba(0, 229, 255, 0.25)'
                  }}
                >
                  {isAnalyzing ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" />
                      <span>Inspecting with AI Firewall...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck size={18} />
                      <span>Analyze Request</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setRequestText('');
                    setAmount('');
                    setRecipientId('');
                    setMemo('');
                    setActivePresetId(null);
                    setPendingConfirmation(null);
                    setVerdict(null);
                    setActionError(null);
                    setTransferSuccess(null);
                  }}
                  style={{
                    backgroundColor: 'transparent',
                    border: '1px solid #1e356e',
                    borderRadius: 8,
                    color: '#94a3b8',
                    padding: '0.75rem 1rem',
                    fontSize: '0.85rem',
                    cursor: 'pointer'
                  }}
                >
                  Clear
                </button>
              </div>
            </form>

            {/* ERROR NOTIFICATION */}
            {actionError && (
              <div
                style={{
                  marginTop: '1rem',
                  padding: '0.75rem',
                  borderRadius: 8,
                  backgroundColor: 'rgba(244, 63, 94, 0.15)',
                  border: '1px solid #f43f5e',
                  color: '#fca5a5',
                  fontSize: '0.8rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8
                }}
              >
                <XCircle size={16} style={{ color: '#f43f5e', flexShrink: 0 }} />
                <span>{actionError}</span>
              </div>
            )}

            {/* SUCCESS NOTIFICATION */}
            {transferSuccess && (
              <div
                style={{
                  marginTop: '1rem',
                  padding: '0.75rem',
                  borderRadius: 8,
                  backgroundColor: 'rgba(16, 185, 129, 0.15)',
                  border: '1px solid #10b981',
                  color: '#a7f3d0',
                  fontSize: '0.8rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8
                }}
              >
                <CheckCircle2 size={16} style={{ color: '#10b981', flexShrink: 0 }} />
                <div>
                  <strong>Transfer Executed!</strong> Sent ${transferSuccess.amount.toFixed(2)} to {transferSuccess.recipientId}. Ledger updated.
                </div>
              </div>
            )}

            {/* MANDATORY 2-STEP CONFIRMATION CARD (Requirement 11) */}
            {pendingConfirmation && (
              <div
                style={{
                  marginTop: '1rem',
                  padding: '1rem',
                  borderRadius: 8,
                  backgroundColor: '#10224d',
                  border: '1px solid #38bdf8',
                  boxShadow: '0 0 20px rgba(56, 189, 248, 0.2)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '0.5rem' }}>
                  <Lock size={16} style={{ color: '#38bdf8' }} />
                  <h4 style={{ fontSize: '0.85rem', fontWeight: 700, margin: 0, color: '#ffffff' }}>
                    Secondary Confirmation Required (Zero-Trust)
                  </h4>
                </div>
                <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '0 0 0.75rem 0' }}>
                  The AI Firewall passed this request. Under FinTech security policy, funds are <strong>never</strong> transferred automatically. You must explicitly confirm with this cryptographically verified token.
                </p>

                <div
                  style={{
                    backgroundColor: '#070f24',
                    padding: '0.6rem 0.8rem',
                    borderRadius: 6,
                    border: '1px solid #1a2f66',
                    marginBottom: '0.75rem',
                    fontSize: '0.75rem'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ color: '#64748b' }}>Transfer Amount:</span>
                    <strong style={{ color: '#38bdf8' }}>${Number(pendingConfirmation.amount).toFixed(2)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ color: '#64748b' }}>Recipient:</span>
                    <strong style={{ color: '#f1f5f9' }}>{pendingConfirmation.recipientId}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Single-Use Token:</span>
                    <span className="font-mono" style={{ color: '#a5f3fc', fontSize: '0.7rem' }}>
                      {pendingConfirmation.token.slice(0, 18)}...
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={handleConfirmTransfer}
                    disabled={isConfirming}
                    style={{
                      flex: 1,
                      backgroundColor: '#10b981',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: 6,
                      padding: '0.6rem',
                      fontWeight: 700,
                      fontSize: '0.8rem',
                      cursor: isConfirming ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6
                    }}
                  >
                    {isConfirming ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                    Confirm & Execute Transfer
                  </button>
                  <button
                    onClick={() => setPendingConfirmation(null)}
                    style={{
                      backgroundColor: 'transparent',
                      border: '1px solid #1e356e',
                      borderRadius: 6,
                      color: '#94a3b8',
                      padding: '0.6rem 0.8rem',
                      fontSize: '0.8rem',
                      cursor: 'pointer'
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* RIGHT: FIREWALL VERDICT & TELEMETRY */}
          <section
            style={{
              backgroundColor: '#0c1736',
              border: '1px solid #1a2f66',
              borderRadius: 12,
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', borderBottom: '1px solid #182e63', paddingBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Shield size={18} style={{ color: '#00e5ff' }} />
                <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: '#ffffff' }}>
                  Firewall Inspection Verdict
                </h3>
              </div>

              {/* Tab Selector */}
              <div style={{ display: 'flex', gap: 4, backgroundColor: '#070f24', padding: 2, borderRadius: 6, border: '1px solid #182e63' }}>
                <button
                  onClick={() => setVerdictTab('summary')}
                  style={{
                    backgroundColor: verdictTab === 'summary' ? '#182e63' : 'transparent',
                    color: verdictTab === 'summary' ? '#00e5ff' : '#94a3b8',
                    border: 'none',
                    borderRadius: 4,
                    padding: '3px 8px',
                    fontSize: '0.7rem',
                    cursor: 'pointer'
                  }}
                >
                  Summary
                </button>
                <button
                  onClick={() => setVerdictTab('json')}
                  style={{
                    backgroundColor: verdictTab === 'json' ? '#182e63' : 'transparent',
                    color: verdictTab === 'json' ? '#00e5ff' : '#94a3b8',
                    border: 'none',
                    borderRadius: 4,
                    padding: '3px 8px',
                    fontSize: '0.7rem',
                    cursor: 'pointer'
                  }}
                >
                  Strict JSON
                </button>
                <button
                  onClick={() => setVerdictTab('telemetry')}
                  style={{
                    backgroundColor: verdictTab === 'telemetry' ? '#182e63' : 'transparent',
                    color: verdictTab === 'telemetry' ? '#00e5ff' : '#94a3b8',
                    border: 'none',
                    borderRadius: 4,
                    padding: '3px 8px',
                    fontSize: '0.7rem',
                    cursor: 'pointer'
                  }}
                >
                  Telemetry
                </button>
              </div>
            </div>

            {/* Verdict Display */}
            {!verdict ? (
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '2rem 1rem',
                  color: '#64748b',
                  textAlign: 'center'
                }}
              >
                <Shield style={{ color: '#182e63', marginBottom: '0.75rem' }} size={48} />
                <h4 style={{ fontSize: '0.9rem', color: '#94a3b8', margin: '0 0 0.25rem 0' }}>Firewall Standby</h4>
                <p style={{ fontSize: '0.75rem', maxWidth: 300, margin: 0 }}>
                  Enter a request or choose a quick test preset to inspect adversarial risks, prompt injection, and authorization.
                </p>
              </div>
            ) : (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {verdictTab === 'summary' && (
                  <>
                    {/* Status Banner */}
                    <div
                      style={{
                        padding: '1rem',
                        borderRadius: 8,
                        backgroundColor: verdict.status === 'APPROVED' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(244, 63, 94, 0.12)',
                        border: `1px solid ${verdict.status === 'APPROVED' ? '#10b981' : '#f43f5e'}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        {verdict.status === 'APPROVED' ? (
                          <ShieldCheck size={32} style={{ color: '#10b981' }} />
                        ) : (
                          <ShieldAlert size={32} style={{ color: '#f43f5e' }} />
                        )}
                        <div>
                          <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8' }}>
                            Security Verdict
                          </div>
                          <div
                            style={{
                              fontSize: '1.4rem',
                              fontWeight: 800,
                              color: verdict.status === 'APPROVED' ? '#10b981' : '#f43f5e'
                            }}
                          >
                            {verdict.status}
                          </div>
                        </div>
                      </div>

                      {/* Risk Score Circle */}
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Risk Score</div>
                        <div
                          style={{
                            fontSize: '1.5rem',
                            fontWeight: 800,
                            color: getRiskColor(verdict.risk_score).text
                          }}
                        >
                          {verdict.risk_score} <span style={{ fontSize: '0.8rem', color: '#64748b' }}>/ 100</span>
                        </div>
                      </div>
                    </div>

                    {/* Threat Category & Intent Chips */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                      <div
                        style={{
                          backgroundColor: '#070f24',
                          border: '1px solid #182e63',
                          borderRadius: 8,
                          padding: '0.6rem 0.8rem'
                        }}
                      >
                        <div style={{ fontSize: '0.65rem', color: '#64748b', textTransform: 'uppercase' }}>Threat Category</div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: verdict.threat_category === 'NONE' ? '#10b981' : '#f43f5e', marginTop: 2 }}>
                          {verdict.threat_category}
                        </div>
                      </div>

                      <div
                        style={{
                          backgroundColor: '#070f24',
                          border: '1px solid #182e63',
                          borderRadius: 8,
                          padding: '0.6rem 0.8rem'
                        }}
                      >
                        <div style={{ fontSize: '0.65rem', color: '#64748b', textTransform: 'uppercase' }}>Detected Intent</div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#38bdf8', marginTop: 2 }}>
                          {verdict.intent}
                        </div>
                      </div>
                    </div>

                    {/* Technical Explanation */}
                    <div
                      style={{
                        backgroundColor: '#070f24',
                        border: '1px solid #182e63',
                        borderRadius: 8,
                        padding: '0.75rem 0.9rem'
                      }}
                    >
                      <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Info size={12} /> Security Reason & Explanation
                      </div>
                      <p style={{ margin: 0, fontSize: '0.8rem', color: '#cbd5e1', lineHeight: 1.45 }}>
                        {verdict.explanation}
                      </p>
                    </div>

                    {/* Authorization Invariant Status */}
                    <div
                      style={{
                        padding: '0.6rem 0.8rem',
                        borderRadius: 8,
                        backgroundColor: verdict.transaction_allowed ? 'rgba(16, 185, 129, 0.08)' : 'rgba(100, 116, 139, 0.08)',
                        border: `1px solid ${verdict.transaction_allowed ? 'rgba(16, 185, 129, 0.3)' : 'rgba(100, 116, 139, 0.3)'}`,
                        fontSize: '0.75rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}
                    >
                      <span style={{ color: '#94a3b8' }}>Banking Transaction Allowed:</span>
                      <strong style={{ color: verdict.transaction_allowed ? '#10b981' : '#f43f5e' }}>
                        {verdict.transaction_allowed ? 'YES (Pending 2-Step Confirmation)' : 'NO (State Mutation Denied)'}
                      </strong>
                    </div>
                  </>
                )}

                {verdictTab === 'json' && (
                  <div style={{ position: 'relative' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Strict JSON Response Schema (Requirement 4)</span>
                      <button
                        onClick={() => navigator.clipboard.writeText(JSON.stringify(verdict, null, 2))}
                        style={{
                          backgroundColor: '#182e63',
                          border: 'none',
                          borderRadius: 4,
                          color: '#00e5ff',
                          padding: '2px 8px',
                          fontSize: '0.65rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4
                        }}
                      >
                        <Copy size={10} /> Copy JSON
                      </button>
                    </div>
                    <pre
                      className="font-mono"
                      style={{
                        backgroundColor: '#070f24',
                        border: '1px solid #182e63',
                        borderRadius: 8,
                        padding: '0.75rem',
                        fontSize: '0.72rem',
                        color: '#a5f3fc',
                        overflowX: 'auto',
                        maxHeight: 280,
                        margin: 0
                      }}
                    >
                      {JSON.stringify(
                        {
                          status: verdict.status,
                          risk_score: verdict.risk_score,
                          threat_category: verdict.threat_category,
                          explanation: verdict.explanation,
                          intent: verdict.intent,
                          transaction_allowed: verdict.transaction_allowed,
                          mode: verdict.mode,
                          eventId: verdict.eventId
                        },
                        null,
                        2
                      )}
                    </pre>
                  </div>
                )}

                {verdictTab === 'telemetry' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.75rem' }}>
                    <div style={{ backgroundColor: '#070f24', padding: '0.75rem', borderRadius: 8, border: '1px solid #182e63' }}>
                      <div style={{ color: '#64748b', marginBottom: 2 }}>Inspection Mode</div>
                      <div style={{ color: '#00e5ff', fontWeight: 600 }}>{verdict.mode}</div>
                    </div>
                    <div style={{ backgroundColor: '#070f24', padding: '0.75rem', borderRadius: 8, border: '1px solid #182e63' }}>
                      <div style={{ color: '#64748b', marginBottom: 2 }}>Inspection Stage</div>
                      <div style={{ color: '#f1f5f9', fontWeight: 600 }}>{verdict.details?.stage || 'PIPELINE_ORCHESTRATOR'}</div>
                    </div>
                    {verdict.details?.matched_rule && (
                      <div style={{ backgroundColor: '#070f24', padding: '0.75rem', borderRadius: 8, border: '1px solid #182e63' }}>
                        <div style={{ color: '#64748b', marginBottom: 2 }}>Rule Matched</div>
                        <div style={{ color: '#f43f5e', fontWeight: 600 }} className="font-mono">
                          {verdict.details.matched_rule}
                        </div>
                      </div>
                    )}
                    <div style={{ backgroundColor: '#070f24', padding: '0.75rem', borderRadius: 8, border: '1px solid #182e63' }}>
                      <div style={{ color: '#64748b', marginBottom: 2 }}>Security Notice</div>
                      <div style={{ color: '#cbd5e1' }}>{verdict.details?.security_notice || verdict.details?.regex_warning}</div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>

        {/* BOTTOM SECTION: TABS (LEDGER, AUDIT LOG, ARCHITECTURE) */}
        <section
          style={{
            backgroundColor: '#0c1736',
            border: '1px solid #1a2f66',
            borderRadius: 12,
            overflow: 'hidden',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)'
          }}
        >
          {/* Navigation Bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              borderBottom: '1px solid #182e63',
              backgroundColor: '#09122a',
              padding: '0.5rem 1rem',
              gap: '0.5rem'
            }}
          >
            <button
              onClick={() => setBottomTab('ledger')}
              style={{
                backgroundColor: bottomTab === 'ledger' ? '#142757' : 'transparent',
                color: bottomTab === 'ledger' ? '#00e5ff' : '#94a3b8',
                border: 'none',
                borderRadius: 6,
                padding: '0.5rem 1rem',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <Database size={15} />
              Mock Banking Ledger ({transactions.length})
            </button>

            <button
              onClick={() => setBottomTab('events')}
              style={{
                backgroundColor: bottomTab === 'events' ? '#142757' : 'transparent',
                color: bottomTab === 'events' ? '#00e5ff' : '#94a3b8',
                border: 'none',
                borderRadius: 6,
                padding: '0.5rem 1rem',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <Activity size={15} />
              Security Event Audit Log ({events.length})
            </button>

            <button
              onClick={() => setBottomTab('architecture')}
              style={{
                backgroundColor: bottomTab === 'architecture' ? '#142757' : 'transparent',
                color: bottomTab === 'architecture' ? '#00e5ff' : '#94a3b8',
                border: 'none',
                borderRadius: 6,
                padding: '0.5rem 1rem',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <Sliders size={15} />
              Blue-Team Defense Matrix
            </button>
          </div>

          {/* TAB 1: BANKING LEDGER */}
          {bottomTab === 'ledger' && (
            <div style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.9rem', color: '#ffffff' }}>In-Memory Transaction History</h4>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8' }}>
                    Demonstrating zero-trust state updates. Only backend-confirmed tokens alter this ledger.
                  </p>
                </div>
                {account && (
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Account: {account.accountId}</span>
                    <div style={{ fontSize: '1rem', fontWeight: 700, color: '#38bdf8' }}>{account.balanceFormatted}</div>
                  </div>
                )}
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #182e63', color: '#64748b', textAlign: 'left' }}>
                      <th style={{ padding: '0.6rem 0.75rem' }}>Transaction ID</th>
                      <th style={{ padding: '0.6rem 0.75rem' }}>Timestamp</th>
                      <th style={{ padding: '0.6rem 0.75rem' }}>Type</th>
                      <th style={{ padding: '0.6rem 0.75rem' }}>Amount</th>
                      <th style={{ padding: '0.6rem 0.75rem' }}>Recipient</th>
                      <th style={{ padding: '0.6rem 0.75rem' }}>Memo</th>
                      <th style={{ padding: '0.6rem 0.75rem' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                          No transactions recorded yet.
                        </td>
                      </tr>
                    ) : (
                      transactions.map((txn) => (
                        <tr key={txn.id} style={{ borderBottom: '1px solid #122247' }}>
                          <td style={{ padding: '0.6rem 0.75rem' }} className="font-mono">
                            {txn.id}
                          </td>
                          <td style={{ padding: '0.6rem 0.75rem', color: '#94a3b8' }}>
                            {new Date(txn.timestamp).toLocaleTimeString()}
                          </td>
                          <td style={{ padding: '0.6rem 0.75rem' }}>
                            <span
                              style={{
                                padding: '2px 6px',
                                borderRadius: 4,
                                fontSize: '0.65rem',
                                backgroundColor: txn.type === 'DEPOSIT' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(56, 189, 248, 0.15)',
                                color: txn.type === 'DEPOSIT' ? '#10b981' : '#38bdf8'
                              }}
                            >
                              {txn.type}
                            </span>
                          </td>
                          <td style={{ padding: '0.6rem 0.75rem', fontWeight: 700, color: txn.type === 'DEPOSIT' ? '#10b981' : '#f1f5f9' }}>
                            {txn.type === 'DEPOSIT' ? '+' : '-'}${Number(txn.amount).toFixed(2)}
                          </td>
                          <td style={{ padding: '0.6rem 0.75rem' }}>{txn.recipientId}</td>
                          <td style={{ padding: '0.6rem 0.75rem', color: '#94a3b8' }}>{txn.memo}</td>
                          <td style={{ padding: '0.6rem 0.75rem' }}>
                            <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: 4 }}>
                              <CheckCircle2 size={12} /> {txn.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: SECURITY EVENT AUDIT LOG */}
          {bottomTab === 'events' && (
            <div style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.9rem', color: '#ffffff' }}>Chronological Security Audit Log</h4>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8' }}>
                    All requests evaluated by the rule engine and semantic AI firewall are permanently logged for forensic analysis.
                  </p>
                </div>
                <button
                  onClick={fetchEvents}
                  style={{
                    backgroundColor: 'transparent',
                    border: '1px solid #1e356e',
                    borderRadius: 6,
                    color: '#94a3b8',
                    padding: '4px 8px',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4
                  }}
                >
                  <RefreshCw size={12} /> Refresh Log
                </button>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #182e63', color: '#64748b', textAlign: 'left' }}>
                      <th style={{ padding: '0.6rem 0.75rem' }}>Event ID</th>
                      <th style={{ padding: '0.6rem 0.75rem' }}>Timestamp</th>
                      <th style={{ padding: '0.6rem 0.75rem' }}>Verdict</th>
                      <th style={{ padding: '0.6rem 0.75rem' }}>Risk Score</th>
                      <th style={{ padding: '0.6rem 0.75rem' }}>Threat Category</th>
                      <th style={{ padding: '0.6rem 0.75rem' }}>Request Preview</th>
                      <th style={{ padding: '0.6rem 0.75rem' }}>Firewall Mode</th>
                    </tr>
                  </thead>
                  <tbody>
                    {events.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                          No security events recorded yet. Run a request to generate audit logs.
                        </td>
                      </tr>
                    ) : (
                      events.map((evt) => (
                        <tr key={evt.id} style={{ borderBottom: '1px solid #122247' }}>
                          <td style={{ padding: '0.6rem 0.75rem' }} className="font-mono">
                            {evt.id}
                          </td>
                          <td style={{ padding: '0.6rem 0.75rem', color: '#94a3b8' }}>
                            {new Date(evt.timestamp).toLocaleTimeString()}
                          </td>
                          <td style={{ padding: '0.6rem 0.75rem' }}>
                            <span
                              style={{
                                padding: '2px 6px',
                                borderRadius: 4,
                                fontSize: '0.65rem',
                                fontWeight: 700,
                                backgroundColor: evt.status === 'APPROVED' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)',
                                color: evt.status === 'APPROVED' ? '#10b981' : '#f43f5e'
                              }}
                            >
                              {evt.status}
                            </span>
                          </td>
                          <td style={{ padding: '0.6rem 0.75rem', fontWeight: 700, color: getRiskColor(evt.risk_score).text }}>
                            {evt.risk_score}
                          </td>
                          <td style={{ padding: '0.6rem 0.75rem', color: '#cbd5e1' }}>
                            {evt.threat_category}
                          </td>
                          <td style={{ padding: '0.6rem 0.75rem', color: '#94a3b8', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {evt.requestPreview}
                          </td>
                          <td style={{ padding: '0.6rem 0.75rem', color: '#64748b' }}>
                            {evt.mode}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: DEFENSE MATRIX & ARCHITECTURE */}
          {bottomTab === 'architecture' && (
            <div style={{ padding: '1.25rem' }}>
              <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: '#ffffff' }}>
                BankSim Blue-Team Multi-Tier Defense Matrix
              </h4>
              <p style={{ margin: '0 0 1rem 0', fontSize: '0.75rem', color: '#94a3b8' }}>
                Key architectural principles implemented across BankSim to prevent prompt injection, privilege escalation, and unauthorized banking execution.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                <div style={{ backgroundColor: '#070f24', padding: '1rem', borderRadius: 8, border: '1px solid #182e63' }}>
                  <div style={{ color: '#00e5ff', fontWeight: 700, fontSize: '0.85rem', marginBottom: 4 }}>
                    1. Data / Instruction Isolation
                  </div>
                  <p style={{ fontSize: '0.75rem', color: '#cbd5e1', margin: 0 }}>
                    User instructions and transaction memos are strictly enclosed within XML delimiters (<code>&lt;untrusted_user_request&gt;</code>) in <code>prompts/system-prompt.txt</code>. The LLM is instructed to treat all enclosed content as passive data, never instructions.
                  </p>
                </div>

                <div style={{ backgroundColor: '#070f24', padding: '1rem', borderRadius: 8, border: '1px solid #182e63' }}>
                  <div style={{ color: '#00e5ff', fontWeight: 700, fontSize: '0.85rem', marginBottom: 4 }}>
                    2. Advisory-Only Principle
                  </div>
                  <p style={{ fontSize: '0.75rem', color: '#cbd5e1', margin: 0 }}>
                    The LLM never possesses banking execution tools, ledger database access, or authorization tokens. It acts purely as a classification firewall. Trusted backend code enforces all authorization logic.
                  </p>
                </div>

                <div style={{ backgroundColor: '#070f24', padding: '1rem', borderRadius: 8, border: '1px solid #182e63' }}>
                  <div style={{ color: '#00e5ff', fontWeight: 700, fontSize: '0.85rem', marginBottom: 4 }}>
                    3. Fail-Closed Policy
                  </div>
                  <p style={{ fontSize: '0.75rem', color: '#cbd5e1', margin: 0 }}>
                    If the LLM returns invalid JSON, schema mismatches, network timeouts, or non-deterministic outputs, BankSim automatically fails closed (blocks the transaction with 95 risk score).
                  </p>
                </div>

                <div style={{ backgroundColor: '#070f24', padding: '1rem', borderRadius: 8, border: '1px solid #182e63' }}>
                  <div style={{ color: '#00e5ff', fontWeight: 700, fontSize: '0.85rem', marginBottom: 4 }}>
                    4. 2-Step Confirmation Tokens
                  </div>
                  <p style={{ fontSize: '0.75rem', color: '#cbd5e1', margin: 0 }}>
                    Approved transfers issue single-use, cryptographically generated tokens valid for 5 minutes. Ledger balances are only deducted when the backend re-validates the token upon explicit user confirmation.
                  </p>
                </div>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
