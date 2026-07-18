export function parseImportConfig(json) {
  let data;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error('Invalid JSON');
  }

  if (!data.departments || !Array.isArray(data.departments) || data.departments.length === 0) {
    throw new Error('File must contain a "departments" array');
  }

  const departments = data.departments.map((d) => ({
    id: d.id || `dept-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: d.name || d.id || 'Department',
    colorVar: d.colorVar || '--color-budget',
    allocation: d.allocation ?? d.allocation_percent ?? 0,
    agents: (d.agents || []).map((a) => ({
      id: a.id || `agent-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: a.name || a.id || 'Agent',
      allocation: a.allocation ?? a.allocation_percent ?? 100,
      description: a.description || '',
    })),
  }));

  return {
    totalBudget: data.totalBudget ?? data.total_budget_tokens ?? 10_000_000,
    selectedModel: data.selectedModel ?? data.selected_model?.id ?? 'gpt-4o',
    thresholds: {
      warning: data.thresholds?.warning ?? 60,
      danger: data.thresholds?.danger ?? 85,
    },
    departments,
  };
}
