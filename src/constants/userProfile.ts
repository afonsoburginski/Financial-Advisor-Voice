/**
 * Perfil do criador (Afonso) — contexto fixo para a IA e saudações.
 * Dados financeiros concretos vêm da base local (SQLite), não daqui.
 */
export const USER_PROFILE = {
  nomeTratamento: "Afonso",
  nomeCompleto: "Afonso Kevin Burginski",
  nascimento: "2001-01-23",
  idade: 25,
  profissao: "Desenvolvedor Sênior",
  estadoCivil: "Casado",
  filhos: "Uma filha de cerca de 1 ano e meio",
  localizacaoAtual: "Vitória, Espírito Santo",
  mudancaRecente:
    "Mudança recente para Vitória, ES, com data de referência 16/03/2026",
  focosApp:
    "Tomada de decisão de vida, carreira, finanças pessoais e controlo financeiro (o que gastou, o que recebeu, metas).",
} as const;

/** Bloco de texto injetado no system prompt da OpenAI (sem valores monetários mock). */
export function buildUserContextForOpenAI(): string {
  return [
    "### Perfil humano do utilizador (fixo)",
    `Nome completo: ${USER_PROFILE.nomeCompleto}`,
    `Nome de tratamento: ${USER_PROFILE.nomeTratamento}`,
    `Idade: ${USER_PROFILE.idade} anos · Data de nascimento: ${USER_PROFILE.nascimento}`,
    `Profissão: ${USER_PROFILE.profissao}`,
    `Família: ${USER_PROFILE.estadoCivil}. ${USER_PROFILE.filhos}.`,
    `Local: ${USER_PROFILE.localizacaoAtual}. ${USER_PROFILE.mudancaRecente}`,
    `Objetivos com a app: ${USER_PROFILE.focosApp}`,
    "",
    "Benefícios relevantes (PCD — visão monocular): isenções de IPVA e IOF podem aplicar-se a veículos e operações; não inventes valores de isenção sem dados na base.",
  ].join("\n");
}
