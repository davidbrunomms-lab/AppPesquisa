import { Injectable, Logger } from '@nestjs/common';
import { AppConfig } from '../../config/app-config';
import { AiPort } from './ai.port';

/** Sem LLM: o motor de regras determinístico gera todo o conteúdo. */
@Injectable()
export class RulesOnlyAiAdapter extends AiPort {
  readonly name = 'rules';
  async complete(): Promise<string | null> {
    return null;
  }
}

/** Qualquer API compatível com /chat/completions (OpenAI, Azure, gateways, modelos locais). */
@Injectable()
export class OpenAiCompatibleAdapter extends AiPort {
  readonly name = 'llm';
  private readonly logger = new Logger('AI');

  constructor(private readonly config: AppConfig) {
    super();
  }

  async complete(system: string, prompt: string): Promise<string | null> {
    const { apiUrl, apiKey, model } = this.config.ai;
    try {
      const res = await fetch(`${apiUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          temperature: 0.3,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: prompt },
          ],
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      return json.choices?.[0]?.message?.content?.trim() || null;
    } catch (error) {
      this.logger.warn(`Provedor de IA indisponível: ${(error as Error).message}`);
      return null;
    }
  }
}
