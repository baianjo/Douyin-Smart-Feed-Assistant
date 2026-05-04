export type ApiProviderId =
  | 'deepseek'
  | 'kimi'
  | 'qwen'
  | 'glm'
  | 'gemini'
  | 'custom';

export type DecisionAction = 'like' | 'neutral' | 'dislike';

export interface VideoContext {
  title: string;
  author: string;
  tags: string[];
  url: string;
  isLive: boolean;
}

export interface DecisionResult {
  action: DecisionAction;
  reason: string;
}

export interface UserConfig {
  apiKey: string;
  customEndpoint: string;
  customModel: string;
  apiProvider: ApiProviderId;
  judgeMode: 'single' | 'double';
  selectedTemplate: string;
  promptLike: string;
  promptNeutral: string;
  promptDislike: string;
  minDelay: number;
  maxDelay: number;
  runDuration: number;
  skipProbability: number;
  watchBeforeLike: [number, number];
  maxRetries: number;
  enableComments: boolean;
  panelMinimized: boolean;
  panelPosition: {
    x: number;
    y: number;
  };
}
