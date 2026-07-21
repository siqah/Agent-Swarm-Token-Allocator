import React, { useState, useCallback, useMemo } from 'react';
import { useNodesState, useEdgesState } from '@xyflow/react';
import { Play, Save, FolderOpen, PieChart, Layers, Loader2, Check } from 'lucide-react';
import { WorkflowProvider, useWorkflow } from './context/WorkflowContext';
import AgentLibrary from './components/canvas/AgentLibrary';
import WorkflowCanvas from './components/canvas/WorkflowCanvas';
import AgentConfigPanel from './components/canvas/AgentConfigPanel';
import RunInspector from './components/inspector/RunInspector';
import CostDashboard from './components/cost/CostDashboard';
import './styles/globals.css';

const INITIAL_NODES = [
  {
    id: 'node-1',
    type: 'agentNode',
    position: { x: 100, y: 150 },
    data: {
      name: 'GPT-4 Agent',
      icon: 'Code',
      model: 'gpt-5.6-terra',
      temperature: 0.3,
      systemPrompt: 'Generate code based on prompt requirements.',
      status: 'idle',
    },
  },
  {
    id: 'node-2',
    type: 'agentNode',
    position: { x: 450, y: 150 },
    data: {
      name: 'Claude Agent',
      icon: 'ShieldCheck',
      model: 'claude-3.5-sonnet',
      temperature: 0.5,
      systemPrompt: 'Critique and optimize the provided code for security and clarity.',
      status: 'idle',
    },
  },
];

const INITIAL_EDGES = [
  {
    id: 'e1-2',
    source: 'node-1',
    target: 'node-2',
    animated: true,
    style: { stroke: '#22d3ee', strokeWidth: 2 },
  },
];

function PlannerDashboard() {
  const [nodes, setNodes, onNodesChange] = useNodesState(INITIAL_NODES);
  const [edges, setEdges, onEdgesChange] = useEdgesState(INITIAL_EDGES);
  const [selectedNode, setSelectedNode] = useState(null);
  const [workflowName, setWorkflowName] = useState('New Agent Swarm Workflow');
  const [showCostDashboard, setShowCostDashboard] = useState(true);
  const [activeRightTab, setActiveRightTab] = useState('inspector');
  const [isSaved, setIsSaved] = useState(false);

  const {
    workflows,
    currentWorkflow,
    setCurrentWorkflow,
    runState,
    runLogs,
    isRunning,
    sessionCost,
    saveWorkflow,
    executeRun,
  } = useWorkflow();

  const updateNodeStatus = useCallback((nodeId, status, tokens) => {
    setNodes((nds) =>
      nds.map((n) =>
        n.id === nodeId
          ? {
              ...n,
              data: {
                ...n.data,
                status,
                tokens: tokens !== undefined ? tokens : n.data.tokens,
              },
            }
          : n
      )
    );
  }, [setNodes]);

  const handleSelectNode = useCallback((node) => {
    setSelectedNode(node);
    if (node) setActiveRightTab('config');
  }, []);

  const handleUpdateNode = useCallback((nodeId, newData) => {
    setNodes((nds) =>
      nds.map((n) => (n.id === nodeId ? { ...n, data: newData } : n))
    );
    setSelectedNode((prev) => (prev?.id === nodeId ? { ...prev, data: newData } : prev));
  }, [setNodes]);

  const handleDeleteNode = useCallback((nodeId) => {
    setNodes((nds) => nds.filter((n) => n.id !== nodeId));
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
    setSelectedNode(null);
  }, [setNodes, setEdges]);

  const handleSave = async () => {
    const graph = {
      nodes: nodes.map((n) => ({
        id: n.id,
        type: n.type,
        position: n.position,
        data: n.data,
      })),
      edges: edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
      })),
    };

    await saveWorkflow(workflowName, graph);
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

    const graph = {
      nodes: nodes.map((n) => ({
        id: n.id,
        type: n.type,
        position: n.position,
        data: n.data,
      })),
      edges: edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
      })),
    };

    await executeRun(graph, updateNodeStatus);
  };

  const rightPanel = useMemo(() => {
    if (activeRightTab === 'config' && selectedNode) {
      return (
        <AgentConfigPanel
          selectedNode={selectedNode}
          onUpdateNode={handleUpdateNode}
          onDeleteNode={handleDeleteNode}
          onClose={() => setSelectedNode(null)}
        />
      );
    }
    return (
      <RunInspector
        runState={runState}
        runLogs={runLogs}
        isRunning={isRunning}
      />
    );
  }, [activeRightTab, selectedNode, handleUpdateNode, handleDeleteNode, runState, runLogs, isRunning]);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-background text-foreground font-sans">
      <header className="h-12 border-b border-border bg-surface px-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-primary font-semibold tracking-wide">
            <Layers className="w-4 h-4" />
            <span className="text-sm">Swarm Gateway</span>
          </div>

          <span className="text-border-strong w-px h-4 bg-current opacity-30" />

          <input
            type="text"
            value={workflowName}
            onChange={(e) => setWorkflowName(e.target.value)}
            className="bg-transparent text-sm font-medium text-foreground focus:outline-none focus:bg-hover px-2 py-1 rounded transition-colors"
          />
        </div>

        <div className="flex items-center gap-2">
          {workflows.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <FolderOpen className="w-3.5 h-3.5" />
              <select
                onChange={(e) => handleLoadWorkflow(e.target.value)}
                value={currentWorkflow?.id || ''}
                className="bg-elevated border border-border rounded px-2 py-1 text-xs text-foreground"
              >
                <option value="" disabled>Load Workflow...</option>
                {workflows.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 bg-elevated hover:bg-hover text-foreground border border-border px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors"
          >
            {isSaved ? <Check className="w-3.5 h-3.5 text-success" /> : <Save className="w-3.5 h-3.5" />}
            {isSaved ? 'Saved' : 'Save'}
          </button>

          <button
            onClick={handleRun}
            disabled={isRunning || nodes.length === 0}
            className="flex items-center gap-1.5 bg-primary text-primary-foreground hover:brightness-110 disabled:opacity-40 font-semibold px-3 py-1.5 rounded-md text-xs transition-all"
          >
            {isRunning ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Executing
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                Run
              </>
            )}
          </button>

          <span className="text-border-strong w-px h-4 bg-current opacity-30" />

          <button
            onClick={() => setShowCostDashboard((prev) => !prev)}
            className={`p-1.5 rounded-md border text-xs flex items-center gap-1.5 transition-colors ${
              showCostDashboard
                ? 'bg-primary/10 border-primary/30 text-primary'
                : 'bg-elevated border-border text-muted-foreground hover:text-foreground'
            }`}
            title="Toggle Token Cost Dashboard"
          >
            <PieChart className="w-3.5 h-3.5" />
            <span className="font-mono text-[11px]">${sessionCost.toFixed(4)}</span>
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative">
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
      </div>

      {showCostDashboard && (
        <CostDashboard
          runLogs={runLogs}
          currentSessionCost={sessionCost}
          budgetLimit={1.0}
        />
      )}
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
