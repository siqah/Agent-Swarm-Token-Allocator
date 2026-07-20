import React, { useState, useCallback, useMemo } from 'react';
import { useNodesState, useEdgesState } from '@xyflow/react';
import { Play, Save, FolderOpen, PieChart, Layers, Sparkles, Loader2, Check } from 'lucide-react';
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
  const [activeRightTab, setActiveRightTab] = useState('inspector'); // 'config' | 'inspector'
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

  // Helper to update node status during execution
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

  // Handle Node selection
  const handleSelectNode = useCallback((node) => {
    setSelectedNode(node);
    if (node) setActiveRightTab('config');
  }, []);

  // Update Node Data from config panel
  const handleUpdateNode = useCallback((nodeId, newData) => {
    setNodes((nds) =>
      nds.map((n) => (n.id === nodeId ? { ...n, data: newData } : n))
    );
    setSelectedNode((prev) => (prev?.id === nodeId ? { ...prev, data: newData } : prev));
  }, [setNodes]);

  // Delete Node
  const handleDeleteNode = useCallback((nodeId) => {
    setNodes((nds) => nds.filter((n) => n.id !== nodeId));
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
    setSelectedNode(null);
  }, [setNodes, setEdges]);

  // Handle Save
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

  // Load selected workflow
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

  // Handle Run Execution
  const handleRun = async () => {
    // Reset node statuses
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

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-950 text-slate-100 font-sans">
      {/* Top Header Navigation */}
      <header className="h-14 border-b border-slate-800 bg-slate-900 px-4 flex items-center justify-between z-10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-cyan-400 font-bold tracking-wide">
            <Layers className="w-5 h-5" />
            <span className="text-sm">SWARM GATEWAY</span>
          </div>

          <span className="text-slate-700">|</span>

          {/* Workflow Title Input */}
          <input
            type="text"
            value={workflowName}
            onChange={(e) => setWorkflowName(e.target.value)}
            className="bg-transparent text-sm font-medium text-slate-200 focus:outline-none focus:bg-slate-800/60 px-2 py-1 rounded transition-colors"
          />
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          {/* Workflow Selector */}
          {workflows.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <FolderOpen className="w-3.5 h-3.5" />
              <select
                onChange={(e) => handleLoadWorkflow(e.target.value)}
                value={currentWorkflow?.id || ''}
                className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
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

          {/* Save Button */}
          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
          >
            {isSaved ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Save className="w-3.5 h-3.5" />}
            {isSaved ? 'Saved' : 'Save'}
          </button>

          {/* Run Button */}
          <button
            onClick={handleRun}
            disabled={isRunning || nodes.length === 0}
            className="flex items-center gap-1.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50 text-slate-950 font-bold px-4 py-1.5 rounded-lg text-xs transition-all shadow-lg shadow-cyan-500/20"
          >
            {isRunning ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Executing...
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                Run Workflow
              </>
            )}
          </button>

          <span className="text-slate-700">|</span>

          {/* Toggle Cost Panel */}
          <button
            onClick={() => setShowCostDashboard((prev) => !prev)}
            className={`p-1.5 rounded-lg border text-xs flex items-center gap-1 transition-colors ${
              showCostDashboard
                ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
            }`}
            title="Toggle Token Cost Dashboard"
          >
            <PieChart className="w-4 h-4" />
            <span className="hidden sm:inline font-mono">${sessionCost.toFixed(3)}</span>
          </button>
        </div>
      </header>

      {/* Main Studio Body */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Agent Library Sidebar */}
        <AgentLibrary />

        {/* Interactive React Flow Canvas */}
        <WorkflowCanvas
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          setNodes={setNodes}
          setEdges={setEdges}
          onSelectNode={handleSelectNode}
        />

        {/* Right Sidebar: Config Panel or Inspector */}
        {activeRightTab === 'config' && selectedNode ? (
          <AgentConfigPanel
            selectedNode={selectedNode}
            onUpdateNode={handleUpdateNode}
            onDeleteNode={handleDeleteNode}
            onClose={() => setSelectedNode(null)}
          />
        ) : (
          <RunInspector
            runState={runState}
            runLogs={runLogs}
            isRunning={isRunning}
          />
        )}
      </div>

      {/* Bottom Collapsible Cost Dashboard */}
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
