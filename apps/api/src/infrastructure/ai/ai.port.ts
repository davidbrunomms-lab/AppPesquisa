/**
 * Porta para provedores de IA generativa. Usada apenas para REDIGIR textos
 * (resumos, recomendações). Não possui acesso de escrita a treinos: toda
 * alteração passa por ai_suggestions e aprovação do professor.
 */
export abstract class AiPort {
  abstract readonly name: string;
  /** Retorna null quando o provedor não está disponível (o chamador usa o texto das regras). */
  abstract complete(system: string, prompt: string): Promise<string | null>;
}
