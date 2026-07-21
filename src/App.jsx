import React, { useState, useCallback, useMemo } from 'react';
import { useNodesState, useEdgesState } from '@xyflow/react';
import { Play, Save, FolderOpen, Check, Activity, Workflow, BarChart3, Key, Layers } from 'lucide-react';
import { WorkflowProvider, useWorkflow } from './context/WorkflowContext';
import AgentLibrary from './components/canvas/AgentLibrary';
import WorkflowCanvas from './components/canvas/WorkflowCanvas';
import AgentConfigPanel from './components/canvas/AgentConfigPanel';
import RunInspector from './components/inspector/RunInspector';
import CostDashboard from './components/cost/CostDashboard';
import ProviderKeysPanel from './components/keys/ProviderKeysPanel';
import './styles/globals.css';

const INITIAL_NODES = [
  {
    id: 'node-1', type: 'agentNode', position: { x: 100, y: 150 },
    data: { name: 'GPT-4 Agent', icon: 'Code', model: 'gpt-5.6-terra', temperature: 0.3, systemPrompt: 'Generate code based on prompt requirements.', status: 'idle' },
  },
  {
    id: 'node-2', type: 'agentNode', position: { x: 450, y: 150 },
    data: { name: 'Claude Agent', icon: 'ShieldCheck', model: 'claude-3.5-sonnet', temperature: 0.5, systemPrompt: 'Critique and optimize the provided code for security and clarity.', status: 'idle' },
  },
];

const INITIAL_EDGES = [
  { id: 'e1-2', source: 'node-1', target: 'node-2', animated: true, style: { stroke: '#22d3ee', strokeWidth: 2 } },
];

const NAV_ITEMS = [
  { id: 'canvas', label: 'Canvas', icon: Workflow },
  { id: 'dashboard', label: 'Costs', icon: BarChart3 },
  { id: 'keys', label: 'Keys', icon: Key },
];

function PlannerDashboard() {
  const [nodes, setNodes, onNodesChange] = useNodesState(INITIAL_NODES);
  const [edges, setEdges, onEdgesChange] = useEdgesState(INITIAL_EDGES);
  const [selectedNode, setSelectedNode] = useState(null);
  const [workflowName, setWorkflowName] = useState('New Agent Swarm Workflow');
  const [activeView, setActiveView] = useState('canvas');
  const [activeRightTab, setActiveRightTab] = useState('inspector');
  const [isSaved, setIsSaved] = useState(false);

  const {
    workflows, currentWorkflow, setCurrentWorkflow, runState, runLogs,
    isRunning, sessionCost, simulating, liveUsage, departments,
    saveWorkflow, executeRun, toggleSimulation,
  } = useWorkflow();

  const updateNodeStatus = useCallback((nodeId, status, tokens) => {
    setNodes((nds) => nds.map((n) => n.id === nodeId ? { ...n, data: { ...n.data, status, tokens: tokens !== undefined ? tokens : n.data.tokens } } : n));
  }, [setNodes]);

  const handleSelectNode = useCallback((node) => { setSelectedNode(node); if (node) setActiveRightTab('config'); }, []);
  const handleUpdateNode = useCallback((nodeId, newData) => {
    setNodes((nds) => nds.map((n) => n.id === nodeId ? { ...n, data: newData } : n));
    setSelectedNode((prev) => prev?.id === nodeId ? { ...prev, data: newData } : prev);
  }, [setNodes]);

  const handleDeleteNode = useCallback((nodeId) => {
    setNodes((nds) => nds.filter((n) => n.id !== nodeId));
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
    setSelectedNode(null);
  }, [setNodes, setEdges]);

  const getGraph = useCallback(() => ({
    nodes: nodes.map((n) => ({ id: n.id, type: n.type, position: n.position, data: n.data })),
    edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target })),
  }), [nodes, edges]);

  const handleSave = async () => {
    await saveWorkflow(workflowName, getGraph());
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const handleLoadWorkflow = (wfId) => {
    const wf = workflows.find((w) => w.id === parseInt(wfId, 10));
    if (!wf) return;
    setCurrentWorkflow(wf);
    setWorkflowName(wf.name);
    const graph = typeof wf.graphJson === 'string' ? JSON.parse(wf.graphJson) : wf.graphJson;
    setNodes(graph.nodes || []);
    setEdges(graph.edges || []);
    setSelectedNode(null);
  };

  const handleRun = async () => {
    setNodes((nds) => nds.map((n) => ({ ...n, data: { ...n.data, status: 'pending', tokens: 0 } })));
    setActiveRightTab('inspector');
    await executeRun(getGraph(), updateNodeStatus);
  };

  const rightPanel = useMemo(() => {
    if (activeView !== 'canvas') return null;
    if (activeRightTab === 'config' && selectedNode) {
      return <AgentConfigPanel selectedNode={selectedNode} onUpdateNode={handleUpdateNode} onDeleteNode={handleDeleteNode} onClose={() => setSelectedNode(null)} />;
    }
    return <RunInspector runState={runState} runLogs={runLogs} isRunning={isRunning} />;
  }, [activeView, activeRightTab, selectedNode, handleUpdateNode, handleDeleteNode, runState, runLogs, isRunning]);

  const totalCost = sessionCost;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground font-sans">
      {/* Sidebar */}
      <nav className="w-14 bg-surface border-r border-border flex flex-col items-center py-3 gap-1 shrink-0">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10 text-primary mb-3">
          <Layers className="w-4 h-4" />
        </div>
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveView(id)}
            className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors relative ${
              activeView === id ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-hover'
            }`}
            title={label}
          >
            <Icon className="w-4 h-4" />
          </button>
        ))}

        <div className="flex-1" />

        <button
          onClick={toggleSimulation}
          className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
            simulating ? 'bg-success/15 text-success animate-pulse' : 'text-muted-foreground hover:text-foreground hover:bg-hover'
          }`}
          title={simulating ? 'Stop simulation' : 'Start simulation'}
        >
          <Activity className="w-4 h-4" />
        </button>
      </nav>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header bar */}
        <header className="h-12 border-b border-border bg-surface/80 backdrop-blur-sm px-4 flex items-center justify-between shrink-0">
          {activeView === 'canvas' && (
            <>
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={workflowName}
                  onChange={(e) => setWorkflowName(e.target.value)}
                  className="bg-transparent text-sm font-medium text-foreground focus:outline-none px-2 py-1 rounded hover:bg-hover/50 transition-colors"
                />
              </div>
              <div className="flex items-center gap-2">
                {workflows.length > 0 && (
                  <select
                    onChange={(e) => handleLoadWorkflow(e.target.value)}
                    value={currentWorkflow?.id || ''}
                    className="bg-elevated border border-border rounded-md px-2 py-1.5 text-xs text-foreground"
                  >
                    <option value="" disabled>Load...</option>
                    {workflows.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                )}
                <button onClick={handleSave} className="flex items-center gap-1.5 bg-elevated hover:bg-hover text-foreground border border-border px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors">
                  {isSaved ? <Check className="w-3.5 h-3.5 text-success" /> : <Save className="w-3.5 h-3.5" />}
                  {isSaved ? 'Saved' : 'Save'}
                </button>
                <button onClick={handleRun} disabled={isRunning || nodes.length === 0} className="flex items-center gap-1.5 bg-primary text-primary-foreground hover:brightness-110 disabled:opacity-40 font-semibold px-3 py-1.5 rounded-md text-xs transition-all">
                  <Play className="w-3.5 h-3.5 fill-current" />
                  {isRunning ? 'Running...' : 'Run'}
                </button>
              </div>
            </>
          )}

          {activeView === 'dashboard' && (
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-foreground">Cost Dashboard</span>
            </div>
          )}

          {activeView === 'keys' && (
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-foreground">Provider Keys</span>
            </div>
          )}

          <div className="flex items-center gap-2">
            <FolderOpen className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-[11px] font-mono text-muted-foreground">
              ${totalCost.toFixed(4)}
            </span>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {activeView === 'canvas' && (
            <>
              <AgentLibrary />
              <WorkflowCanvas
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                setNodes={setNodes}
                setEdges={setEdges}
                onSelectNode={handleSelectNode}
              />
              {rightPanel}
            </>
          )}

          {activeView === 'dashboard' && (
            <CostDashboard
              runLogs={runLogs}
              currentSessionCost={sessionCost}
              budgetLimit={1.0}
              liveUsage={liveUsage}
              simulating={simulating}
              departments={departments}
            />
          )}

          {activeView === 'keys' && (
            <div className="flex-1 flex items-start justify-center p-8 overflow-y-auto">
              <ProviderKeysPanel embedded />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <WorkflowProvider>
      <PlannerDashboard />
    </WorkflowProvider>
  );
}
