# Agendamento persistente por intervalo, cron e eventos

Criada e atualizada em 2026-11-02. Exemplos: Node 24.22.2, TypeScript 5.9.3,
cron-parser 5.10.3. Python não utilizado.

## Objetivo e pré-requisitos

Entender a diferença entre calcular uma ocorrência e executar um trabalho durável.
Leia antes as lessons [11](11%20-%20Fila%20duravel%20em%20PostgreSQL%20com%20lease.md),
[12](12%20-%20Configuracao%20tipada%20com%20falha%20rapida.md) e
[18](18%20-%20Mutacoes%20com%20Server%20Actions%20e%20integridade%20no%20PostgreSQL.md).
Este conceito combina fila, configuração e formulário administrativo, por isso aparece
depois dessas bases na trilha.

## Modelo mental

Uma agenda guarda uma promessa: depois de determinado instante pode surgir uma ocorrência.
O planejador transforma essa promessa em um item de fila; o consumidor faz o trabalho.
O timer de 15 segundos apenas consulta o banco. Reiniciar o Node não apaga a agenda.

No [módulo real](../documentacoes/funcionarios/2026-11-02-modulo-funcionarios-virtuais.md),
intervalo significa uma distância em minutos a partir da âncora persistida; cron significa
um horário de calendário em um fuso IANA; evento significa a chegada de um fato registrado.
Não se simula evento com consultas periódicas.

## Exemplo mínimo executável no repositório

Depois do build da API, grave o exemplo em `.run/exemplo-agenda.mts` e execute
`node .run/exemplo-agenda.mts`. Os imports apontam para a implementação compilada.

```typescript
import assert from "node:assert/strict";
import {
  validarAgenda,
  proximaOcorrencia,
  proximasOcorrencias,
} from "../apps/api/dist/funcionarios/agenda.js";

const agora = new Date("2026-11-02T12:00:00Z");
const intervalo = validarAgenda({ gatilho: "INTERVALO", intervalo_min: 30 }, agora);
assert.equal(proximaOcorrencia(intervalo, agora)?.toISOString(), "2026-11-02T12:30:00.000Z");

const diario = validarAgenda({
  gatilho: "CRON", cron: "0 3 * * *", fuso: "America/Sao_Paulo",
}, agora);
assert.equal(proximasOcorrencias(diario, agora)[0], "2026-11-03T06:00:00.000Z");
```

O teste automatizado equivalente está em `apps/api/src/funcionarios/agenda.test.ts`.
O parser respeita fuso e calendário; o projeto aceita cinco campos e recusa a extensão
aleatória `H`, pois uma próxima ocorrência precisa ser reproduzível.
Referência consultada em 2026-11-02: [documentação oficial do cron-parser](https://github.com/harrisiirak/cron-parser).

## Do cálculo puro à persistência

Salvar uma agenda incrementa sua versão. O planejador bloqueia primeiro as atribuições
de agendas vencidas com `FOR UPDATE SKIP LOCKED`, depois relê e bloqueia cada agenda
ainda vencida. Essa ordem também é usada nas edições e evita espera circular entre
pai e filho. Usa o relógio do banco, enfileira e salva a próxima ocorrência na mesma
transação. O consumidor recusa itens com versão antiga antes de executar.

Mudar de 30 para 60 minutos invalida o disparo antigo. Suspender agenda ou atribuição
impede novos disparos; uma tarefa já iniciada mantém seu snapshot e pode concluir.
Ao perder vários intervalos durante uma parada, o motor cria a ocorrência persistida
e avança para a próxima futura; não dispara uma rajada de todas as ocorrências perdidas.

O schema JSON do handler valida a configuração sem converter string em número. Campos
aninhados com nomes de segredo são recusados. Um formulário não envia código executável,
e cadastrar uma tarefa planejada nunca a transforma em handler disponível.

## Erros comuns, limites e trade-offs

- Usar `setInterval` como fonte de verdade perde a agenda ao reiniciar.
- Calcular cron no fuso do servidor altera o horário de negócio.
- Confiar só no clique desabilitado não impede duas instâncias de enfileirar o mesmo fato.
- Prometer exatamente uma execução confunde execução com efeito; a fila entrega ao menos
  uma vez, e o handler precisa garantir idempotência.
- Para uma notificação efêmera sem efeito de negócio, uma fila persistente pode ser desnecessária.

## Verificação e exercícios

Execute `node --test apps/api/dist/funcionarios/agenda.test.js` depois do build.
Com banco temporário local, a suíte HTTP cobre reinício, edição, versão antiga e eventos
repetidos. Os testes de tela continuam manuais.

1. Altere o exemplo para um intervalo de duas horas e calcule três ocorrências.
2. Compare `0 3 * * *` em São Paulo e UTC.
3. Explique por que uma configuração antiga pode continuar no histórico, mas não pode
   iniciar depois de uma edição.
