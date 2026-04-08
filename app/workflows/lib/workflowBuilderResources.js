function itemCountLabel(count) {
  if (!Number.isFinite(Number(count))) return '0 items';
  const normalized = Number(count);
  return `${normalized} item${normalized === 1 ? '' : 's'}`;
}

export function normalizeCollectionOptions(collections = []) {
  return (Array.isArray(collections) ? collections : []).map((collection) => ({
    value: collection.collection_id || collection.id,
    label: collection.name || collection.collection_id || collection.id,
    subtitle: `${collection.source_type || 'unknown'} · ${itemCountLabel(collection.doc_count || 0)}`,
    raw: collection,
  })).filter((option) => option.value);
}

export function normalizeCapabilityOptions(capabilities = []) {
  return (Array.isArray(capabilities) ? capabilities : []).map((capability) => ({
    value: capability.capability_id || capability.id,
    label: capability.name || capability.capability_id || capability.id,
    subtitle: `${capability.source_type || 'unknown'} · ${(capability.risk_level || 'unknown')} risk`,
    raw: capability,
  })).filter((option) => option.value);
}

export function normalizePromptTemplateOptions(templates = []) {
  return (Array.isArray(templates) ? templates : []).map((template) => ({
    value: template.id,
    label: template.name || template.id,
    subtitle: template.category || 'general',
    content: template.activeContent || '',
    raw: template,
  })).filter((option) => option.value);
}

export function buildMissingResourceOption(value, resourceLabel) {
  return {
    value,
    label: value,
    subtitle: `${resourceLabel} unavailable`,
    unavailable: true,
  };
}

function mergeMissingOptions(options, values, resourceLabel) {
  const optionMap = new Map((options || []).map((option) => [option.value, option]));

  for (const value of values || []) {
    if (!value || optionMap.has(value)) continue;
    optionMap.set(value, buildMissingResourceOption(value, resourceLabel));
  }

  return Array.from(optionMap.values());
}

function findActivePromptContent(versions = []) {
  const normalized = Array.isArray(versions) ? versions : [];
  const active = normalized.find((version) => version?.is_active);
  if (active?.content) return active.content;
  return normalized[0]?.content || '';
}

export async function loadWorkflowBuilderResources(fetchImpl = fetch) {
  const errors = [];

  const [collectionsRes, capabilitiesRes, promptTemplatesRes] = await Promise.allSettled([
    fetchImpl('/api/knowledge/collections?limit=100'),
    fetchImpl('/api/capabilities?limit=100'),
    fetchImpl('/api/prompts/templates'),
  ]);

  const collections = collectionsRes.status === 'fulfilled' && collectionsRes.value.ok
    ? (await collectionsRes.value.json()).collections || []
    : [];
  if (collectionsRes.status === 'rejected' || (collectionsRes.status === 'fulfilled' && !collectionsRes.value.ok)) {
    errors.push('knowledge_collections');
  }

  const capabilities = capabilitiesRes.status === 'fulfilled' && capabilitiesRes.value.ok
    ? (await capabilitiesRes.value.json()).capabilities || []
    : [];
  if (capabilitiesRes.status === 'rejected' || (capabilitiesRes.status === 'fulfilled' && !capabilitiesRes.value.ok)) {
    errors.push('capabilities');
  }

  const promptTemplates = promptTemplatesRes.status === 'fulfilled' && promptTemplatesRes.value.ok
    ? (await promptTemplatesRes.value.json()).templates || []
    : [];
  if (promptTemplatesRes.status === 'rejected' || (promptTemplatesRes.status === 'fulfilled' && !promptTemplatesRes.value.ok)) {
    errors.push('prompt_templates');
  }

  const promptTemplatesWithContent = await Promise.all(
    promptTemplates.map(async (template) => {
      try {
        const versionsRes = await fetchImpl(`/api/prompts/templates/${template.id}/versions`);
        if (!versionsRes.ok) {
          errors.push(`prompt_template_versions:${template.id}`);
          return { ...template, activeContent: '' };
        }
        const { versions } = await versionsRes.json();
        return {
          ...template,
          activeContent: findActivePromptContent(versions),
        };
      } catch {
        errors.push(`prompt_template_versions:${template.id}`);
        return { ...template, activeContent: '' };
      }
    })
  );

  return {
    knowledgeCollections: normalizeCollectionOptions(collections),
    capabilities: normalizeCapabilityOptions(capabilities),
    promptTemplates: normalizePromptTemplateOptions(promptTemplatesWithContent),
    errors,
  };
}

export function buildWorkflowResourceLookups({
  knowledgeCollections = [],
  capabilities = [],
  promptTemplates = [],
} = {}) {
  return {
    knowledgeCollections: Object.fromEntries(knowledgeCollections.map((option) => [option.value, option.label])),
    capabilities: Object.fromEntries(capabilities.map((option) => [option.value, option.label])),
    promptTemplates: Object.fromEntries(promptTemplates.map((option) => [option.value, { label: option.label, content: option.content || '' }])),
  };
}

export function mergeWorkflowBuilderResourceOptions(resources, steps = []) {
  const normalizedSteps = Array.isArray(steps) ? steps : [];
  const selectedCollections = normalizedSteps
    .filter((step) => step?.type === 'knowledge_search')
    .map((step) => step?.config?.collection_id)
    .filter(Boolean);
  const selectedCapabilities = normalizedSteps
    .filter((step) => step?.type === 'capability_invoke')
    .map((step) => step?.config?.capability_id)
    .filter(Boolean);

  return {
    ...resources,
    knowledgeCollections: mergeMissingOptions(resources.knowledgeCollections || [], selectedCollections, 'Knowledge collection'),
    capabilities: mergeMissingOptions(resources.capabilities || [], selectedCapabilities, 'Capability'),
  };
}
