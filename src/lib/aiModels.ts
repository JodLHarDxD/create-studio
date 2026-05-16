export interface AIModel {
  id: string;
  displayName: string;
  provider: 'anthropic' | 'openai' | 'google';
  description: string;
  contextWindow: string;
  speed: 'fast' | 'medium' | 'slow';
}

export const AI_MODELS: AIModel[] = [
  // Anthropic
  {
    id: 'claude-sonnet-4-5',
    displayName: 'Claude Sonnet 4.5',
    provider: 'anthropic',
    description: 'Best for coding & deep reasoning',
    contextWindow: '200K',
    speed: 'medium',
  },
  {
    id: 'claude-haiku-4-5-20251001',
    displayName: 'Claude Haiku 4.5',
    provider: 'anthropic',
    description: 'Fast, efficient, great for quick tasks',
    contextWindow: '200K',
    speed: 'fast',
  },
  // OpenAI
  {
    id: 'gpt-4o',
    displayName: 'GPT-4o',
    provider: 'openai',
    description: 'Strong reasoning, different perspective',
    contextWindow: '128K',
    speed: 'medium',
  },
  {
    id: 'gpt-4o-mini',
    displayName: 'GPT-4o Mini',
    provider: 'openai',
    description: 'Cheap, fast OpenAI model',
    contextWindow: '128K',
    speed: 'fast',
  },
  // Google
  {
    id: 'gemini-2.5-flash',
    displayName: 'Gemini 2.5 Flash',
    provider: 'google',
    description: 'Massive context, fast responses',
    contextWindow: '1M',
    speed: 'fast',
  },
  {
    id: 'gemini-2.5-pro',
    displayName: 'Gemini 2.5 Pro',
    provider: 'google',
    description: 'Deep reasoning, 1M context',
    contextWindow: '1M',
    speed: 'slow',
  },
];

export const PROVIDER_LABELS: Record<string, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  google: 'Google',
};

export const MODEL_BY_ID = Object.fromEntries(AI_MODELS.map(m => [m.id, m]));

// LocalStorage keys
export const LS_KEYS = {
  ANTHROPIC_KEY: 'tf_anthropic_key',
  OPENAI_KEY: 'tf_openai_key',
  GOOGLE_KEY: 'tf_google_key',
  SELECTED_MODEL: 'tf_selected_model',
  API_BASE_URL: 'tf_api_base_url',
};

export function getStoredKeys() {
  return {
    anthropic: localStorage.getItem(LS_KEYS.ANTHROPIC_KEY) || '',
    openai: localStorage.getItem(LS_KEYS.OPENAI_KEY) || '',
    google: localStorage.getItem(LS_KEYS.GOOGLE_KEY) || '',
    baseUrl: localStorage.getItem(LS_KEYS.API_BASE_URL) || '',
  };
}

export function saveKeys(keys: { anthropic?: string; openai?: string; google?: string; baseUrl?: string }) {
  if (keys.anthropic !== undefined) localStorage.setItem(LS_KEYS.ANTHROPIC_KEY, keys.anthropic);
  if (keys.openai !== undefined) localStorage.setItem(LS_KEYS.OPENAI_KEY, keys.openai);
  if (keys.google !== undefined) localStorage.setItem(LS_KEYS.GOOGLE_KEY, keys.google);
  if (keys.baseUrl !== undefined) localStorage.setItem(LS_KEYS.API_BASE_URL, keys.baseUrl);
}

export function getSelectedModel(): string {
  return localStorage.getItem(LS_KEYS.SELECTED_MODEL) || 'gemini-2.5-flash';
}

export function setSelectedModel(modelId: string) {
  localStorage.setItem(LS_KEYS.SELECTED_MODEL, modelId);
}
