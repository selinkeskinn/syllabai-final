import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

type EmbeddingPayload = {
  embedding?: number[];
  embeddings?: number[][];
  data?: Array<{ embedding: number[] }>;
};

@Injectable()
export class AiProviderService {
  private readonly provider: string;
  private readonly baseUrl: string;
  private readonly embeddingModel: string;
  private readonly chatModel: string;
  private readonly apiKey?: string;

  constructor(private readonly config: ConfigService) {
    this.provider = this.config.get<string>('AI_PROVIDER') ?? 'ollama';
    this.baseUrl =
      this.config.get<string>('AI_BASE_URL') ?? 'http://localhost:11434';
    this.embeddingModel =
      this.config.get<string>('AI_EMBEDDING_MODEL') ?? 'nomic-embed-text';
    this.chatModel = this.config.get<string>('AI_CHAT_MODEL') ?? 'llama3.1';
    this.apiKey = this.config.get<string>('AI_API_KEY');
  }

  async createEmbedding(input: string): Promise<number[]> {
    const cleanInput = input.trim();

    if (!cleanInput) {
      throw new BadRequestException('Embedding input is required');
    }

    if (this.provider === 'lmstudio') {
      return this.createOpenAiCompatibleEmbedding(cleanInput);
    }

    return this.createOllamaEmbedding(cleanInput);
  }

  async createAnswer(messages: ChatMessage[]): Promise<string> {
    if (this.provider === 'lmstudio') {
      return this.createOpenAiCompatibleAnswer(messages);
    }

    return this.createOllamaAnswer(messages);
  }

  private async createOllamaEmbedding(input: string): Promise<number[]> {
    const response = await this.postJson<EmbeddingPayload>('/api/embeddings', {
      model: this.embeddingModel,
      prompt: input,
    });

    const embedding = response.embedding ?? response.embeddings?.[0];
    return this.assertEmbedding(embedding);
  }

  private async createOpenAiCompatibleEmbedding(
    input: string,
  ): Promise<number[]> {
    const response = await this.postJson<EmbeddingPayload>('/v1/embeddings', {
      model: this.embeddingModel,
      input,
    });

    return this.assertEmbedding(response.data?.[0]?.embedding);
  }

  private async createOllamaAnswer(messages: ChatMessage[]): Promise<string> {
    const response = await this.postJson<{
      message?: { content?: string };
      response?: string;
    }>('/api/chat', {
      model: this.chatModel,
      messages,
      stream: false,
    });

    const answer = response.message?.content ?? response.response;
    return this.assertAnswer(answer);
  }

  private async createOpenAiCompatibleAnswer(
    messages: ChatMessage[],
  ): Promise<string> {
    const response = await this.postJson<{
      choices?: Array<{ message?: { content?: string } }>;
    }>('/v1/chat/completions', {
      model: this.chatModel,
      messages,
      temperature: 0.2,
    });

    return this.assertAnswer(response.choices?.[0]?.message?.content);
  }

  private async postJson<T>(path: string, body: unknown): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.apiKey) {
      headers.Authorization = `Bearer ${this.apiKey}`;
    }

    let response: Response;

    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
    } catch {
      throw new ServiceUnavailableException(
        'AI provider is not reachable. Check AI_BASE_URL and local model server.',
      );
    }

    if (!response.ok) {
      const message = await response.text();
      throw new ServiceUnavailableException(
        `AI provider request failed: ${message || response.statusText}`,
      );
    }

    return (await response.json()) as T;
  }

  private assertEmbedding(embedding?: number[]) {
    if (!embedding?.length) {
      throw new ServiceUnavailableException(
        'AI provider did not return an embedding.',
      );
    }

    return embedding;
  }

  private assertAnswer(answer?: string) {
    if (!answer?.trim()) {
      throw new ServiceUnavailableException(
        'AI provider did not return an answer.',
      );
    }

    return answer.trim();
  }
}
