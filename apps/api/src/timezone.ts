// Deve ser importado antes de qualquer outro módulo: regras de "hoje", "semana" e
// "mês" (dashboards, frequência, relatórios) usam o fuso da operação.
process.env.TZ = process.env.APP_TIMEZONE || 'America/Sao_Paulo';
