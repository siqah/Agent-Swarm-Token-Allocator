import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';

const WorkflowContext = createContext(null);

export function WorkflowProvider({ children }) {
  const [workflows, setWorkflows] = useState([]);
  const [currentWorkflow, setCurrentWorkflow] = useState(null);
  const [runState, setRunState] = useState(null);
  const [runLogs, setRunLogs] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const [sessionCost, setSessionCost] = useState(0);
  const [simulating, setSimulating] = useState(false);
  const [liveUsage, setLiveUsage] = useState({});
  const [departments, setDepartments] = useState([]);
  const pollRef = useRef(null);

  // Toggle background simulation
  const toggleSimulation = useCallback(async () => {
    try {
      const init = await fetch('/api/init');
      const { token } = await init.json();
      const res = await fetch('/api/simulation/toggle', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        const data = await res.json();
        setSimulating(data.simulationActive);
        if (!data.simulationActive) setLiveUsage({});
      }
    } catch {}
  }, []);

  // Poll usage when simulation is active
  useEffect(() => {
    if (!simulating) {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      return;
    }
    const poll = async () => {
      try {
        const res = await fetch('/api/init');
        if (res.ok) {
          const data = await res.json();
          if (data.usage) setLiveUsage(data.usage);
          if (data.departments) setDepartments(data.departments);
        }
      } catch {}
    };
    poll();
    pollRef.current = setInterval(poll, 1500);
    return () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
  }, [simulating]);

  // Fetch list of saved workflows
  const fetchWorkflows = useCallback(async () => {
    try {
      const res = await fetch('/api/workflows');
      if (res.ok) {
        const data = await res.json();
        setWorkflows(data.workflows || []);
      }
    } catch {}
    try {
      const res = await fetch('/api/init');
      if (res.ok) {
        const data = await res.json();
        if (data.departments) setDepartments(data.departments);
      }
    } catch (err) {
      console.error('Failed to fetch workflows:', err);
    }
  }, []);

  useEffect(() => {
    fetchWorkflows();
  }, [fetchWorkflows]);

  // Save new or existing workflow
  const saveWorkflow = useCallback(async (name, graph) => {
    try {
      const payload = { name, graph };
      const url = currentWorkflow?.id ? `/api/workflows/${currentWorkflow.id}` : '/api/workflows';
      const method = currentWorkflow?.id ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        setCurrentWorkflow(data.workflow);
        fetchWorkflows();
        return data.workflow;
      }
    } catch (err) {
      console.error('Save workflow failed:', err);
    }
  }, [currentWorkflow, fetchWorkflows]);

  // Execute workflow
  const executeRun = useCallback(async (graph, nodeStatusUpdater) => {
    setIsRunning(true);
    setRunLogs([]);
    setRunState(null);

    try {
      const res = await fetch('/api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workflowId: currentWorkflow?.id || null,
          graph,
        }),
      });

      if (!res.ok) throw new Error('Failed to start workflow execution');

      const data = await res.json();
      const runId = data.run?.runId || data.run?.id;

      if (!runId) throw new Error('Invalid run ID returned');

      setRunState(data.run);
      setRunLogs(data.logs || []);

      // Subscribe to SSE stream for live DAG updates
      const eventSource = new EventSource(`/api/run/${runId}/stream`);

      eventSource.addEventListener('node_started', (e) => {
        const payload = JSON.parse(e.data);
        nodeStatusUpdater(payload.nodeId, 'running');
        setRunLogs((prev) => {
          const exists = prev.some((l) => l.agentNodeId === payload.nodeId);
          if (exists) return prev.map((l) => l.agentNodeId === payload.nodeId ? { ...l, status: 'running' } : l);
          return [...prev, { agentNodeId: payload.nodeId, agentName: payload.agentName, model: payload.model, status: 'running' }];
        });
      });

      eventSource.addEventListener('node_completed', (e) => {
        const payload = JSON.parse(e.data);
        nodeStatusUpdater(payload.nodeId, 'completed', payload.tokens);
        setRunLogs((prev) =>
          prev.map((l) =>
            l.agentNodeId === payload.nodeId
              ? { ...l, status: 'completed', responseText: payload.responsePreview, totalTokens: payload.tokens }
              : l
          )
        );
      });

      eventSource.addEventListener('node_error', (e) => {
        const payload = JSON.parse(e.data);
        nodeStatusUpdater(payload.nodeId, 'failed');
        setRunLogs((prev) =>
          prev.map((l) =>
            l.agentNodeId === payload.nodeId
              ? { ...l, status: 'failed', errorMessage: payload.error }
              : l
          )
        );
      });

      eventSource.addEventListener('run_completed', (e) => {
        const payload = JSON.parse(e.data);
        setRunState(payload);
        setIsRunning(false);
        setSessionCost((prev) => prev + (payload.totalCost || 0));
        eventSource.close();
      });

      eventSource.addEventListener('run_failed', (e) => {
        const payload = JSON.parse(e.data);
        setRunState(payload);
        setIsRunning(false);
        eventSource.close();
      });

      eventSource.onerror = () => {
        setIsRunning(false);
        eventSource.close();
      };
    } catch (err) {
      console.error('Execution error:', err);
      setIsRunning(false);
    }
  }, [currentWorkflow]);

  return (
    <WorkflowContext.Provider
      value={{
        workflows,
        currentWorkflow,
        setCurrentWorkflow,
        runState,
        runLogs,
        isRunning,
        sessionCost,
        simulating,
        liveUsage,
        departments,
        saveWorkflow,
        executeRun,
        fetchWorkflows,
        toggleSimulation,
      }}
    >
      {children}
    </WorkflowContext.Provider>
  );
}

// eslint-disable-next-line react/only-export-components
export function useWorkflow() {
  const ctx = useContext(WorkflowContext);
  if (!ctx) throw new Error('useWorkflow must be used within WorkflowProvider');
  return ctx;
}
