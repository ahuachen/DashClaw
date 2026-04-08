export const PROVIDER_MODEL_OPTIONS = {
  openai: [
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
    { value: 'gpt-4.1-mini', label: 'GPT-4.1 Mini' },
    { value: 'gpt-4.1', label: 'GPT-4.1' },
    { value: 'gpt-5.4', label: 'GPT-5.4' },
  ],
  anthropic: [
    { value: 'claude-3-5-haiku-latest', label: 'Claude 3.5 Haiku' },
    { value: 'claude-sonnet-4', label: 'Claude Sonnet 4' },
    { value: 'claude-opus-4.1', label: 'Claude Opus 4.1' },
  ],
  groq: [
    { value: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B Instant' },
    { value: 'llama-4-scout', label: 'Llama 4 Scout' },
    { value: 'mixtral-8x7b-32768', label: 'Mixtral 8x7B 32K' },
  ],
  together: [
    { value: 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo', label: 'Llama 3.1 8B Turbo' },
    { value: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo', label: 'Llama 3.1 70B Turbo' },
    { value: 'mistralai/Mixtral-8x7B-Instruct-v0.1', label: 'Mixtral 8x7B Instruct' },
  ],
  perplexity: [
    { value: 'sonar', label: 'Sonar' },
    { value: 'sonar-pro', label: 'Sonar Pro' },
  ],
};

export function getDefaultProviderModel(provider) {
  return PROVIDER_MODEL_OPTIONS[provider]?.[0]?.value || '';
}
