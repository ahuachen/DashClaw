export const PROVIDER_MODEL_OPTIONS = {
  openai: [
    { value: 'gpt-5.4', label: 'GPT-5.4' },
    { value: 'gpt-5.4-mini', label: 'GPT-5.4 Mini' },
    { value: 'gpt-5.4-nano', label: 'GPT-5.4 Nano' },
    { value: 'gpt-4.1', label: 'GPT-4.1' },
  ],
  anthropic: [
    { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
    { value: 'claude-opus-4-6', label: 'Claude Opus 4.6' },
    { value: 'claude-opus-4-1-20250805', label: 'Claude Opus 4.1' },
    { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
    { value: 'claude-opus-4-20250514', label: 'Claude Opus 4' },
    { value: 'claude-3-7-sonnet-latest', label: 'Claude Sonnet 3.7' },
    { value: 'claude-3-5-haiku-latest', label: 'Claude Haiku 3.5' },
  ],
  groq: [
    { value: 'openai/gpt-oss-120b', label: 'GPT-OSS 120B' },
    { value: 'openai/gpt-oss-20b', label: 'GPT-OSS 20B' },
    { value: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B' },
    { value: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B Instant' },
  ],
  together: [
    { value: 'MiniMaxAI/MiniMax-M2.5', label: 'MiniMax M2.5' },
    { value: 'Qwen/Qwen3.5-397B-A17B', label: 'Qwen3.5 397B A17B' },
    { value: 'Qwen/Qwen3.5-9B', label: 'Qwen3.5 9B' },
  ],
  perplexity: [
    { value: 'sonar-pro', label: 'Sonar Pro' },
    { value: 'sonar', label: 'Sonar' },
    { value: 'sonar-reasoning-pro', label: 'Sonar Reasoning Pro' },
    { value: 'sonar-deep-research', label: 'Sonar Deep Research' },
  ],
};

export function getDefaultProviderModel(provider) {
  return PROVIDER_MODEL_OPTIONS[provider]?.[0]?.value || '';
}
