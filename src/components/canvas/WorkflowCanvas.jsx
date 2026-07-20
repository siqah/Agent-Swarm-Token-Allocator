import React, { useCallback, useRef } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import AgentNode from './AgentNode';

const nodeTypes = {
  agentNode: AgentNode,
};

export default function WorkflowCanvas({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  setNodes,
  setEdges,
  onSelectNode,
}) {
  const reactFlowWrapper = useRef(null);

  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge({ ...params, animated: true, style: { stroke: '#22d3ee', strokeWidth: 2 } }, eds)),
    [setEdges]
  );

  const onDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event) => {
      event.preventDefault();
      const rawData = event.dataTransfer.getData('application/reactflow');
      if (!rawData) return;

      const template = JSON.parse(rawData);
      const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();

      const position = {
        x: event.clientX - reactFlowBounds.left - 100,
        y: event.clientY - reactFlowBounds.top - 40,
      };

      const newNode = {
        id: `node-${Date.now()}`,
        type: 'agentNode',
        position,
        data: {
          name: template.name,
          icon: template.icon,
          model: template.model,
          temperature: template.temperature,
          systemPrompt: template.systemPrompt,
          status: 'idle',
        },
      };

      setNodes((nds) => nds.concat(newNode));
      onSelectNode(newNode);
    },
    [setNodes, onSelectNode]
  );

  const onNodeClick = useCallback(
    (_, node) => {
      onSelectNode(node);
    },
    [onSelectNode]
  );

  const onPaneClick = useCallback(() => {
    onSelectNode(null);
  }, [onSelectNode]);

  return (
    <div className="flex-1 h-full relative" ref={reactFlowWrapper}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        fitView
        colorMode="dark"
      >
        <Background color="#334155" gap={24} size={1} />
        <Controls position="bottom-left" />
        <MiniMap
          nodeColor={(n) => {
            if (n.data?.status === 'running') return '#22d3ee';
            if (n.data?.status === 'completed') return '#10b981';
            if (n.data?.status === 'failed') return '#f43f5e';
            return '#475569';
          }}
          maskColor="rgba(15, 23, 42, 0.7)"
          position="bottom-right"
        />
      </ReactFlow>
    </div>
  );
}
