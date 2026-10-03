# Roadmap de implementação — `job-engine-poc`

Guia por marco de estudo (S0–S18). Cada etapa é um **incremento no mesmo
projeto**, validado e fechado com **commit + tag** (`s01`, `s02`, ... `s18`).

Fonte completa da teoria: [`TRILHA-ESTUDO.md`](../../TRILHA-ESTUDO.md).

> **Detalhe por etapa:** cada etapa tem um doc próprio em
> [`docs/stages/`](stages/) focado nas **queries prováveis** e no que a **suite
> de testes** (`tests/p_<numero>.spec.ts`) valida. Ex.: `stages/s01.md`.

## Regra de ouro

1. Estude o tema da etapa antes de codar.
2. Implemente **apenas** o incremento daquela etapa. Nada de antecipar a seguinte.
3. Valide medindo **antes/depois** e registre o resultado em `docs/` (`docs/sNN-*.md`).
4. Feche com `git commit` + `git tag sNN`.
5. Um tema por vez. O valor está em *ver a diferença* que cada incremento faz.

## Convenção de código (MSC)

Cada domínio vive em `src/<dominio>/`:

```
src/<dominio>/
  <dominio>.model.ts       # tipos/entidades TypeORM e formas de dados
  <dominio>.service.ts     # regra de negócio / acesso a dados
  <dominio>.controller.ts  # camada HTTP (Router do Express)
```

O controller é montado em `src/app.ts`. Domínios atuais: `jobs/`, `queue/`,
`metrics/`, `worker-fake/` (+ `health/`).

## Resumo

| # | Tema | Incremento | Tag |
|---|---|---|---|
| S0 | Setup | Postgres + Rabbit + app + seed 1M | `s00` |
| S1 | Modelagem SQL | tabelas `job`/`execution`, medir seq scan | `s01` |
| S2 | Índices + EXPLAIN | índices + comparação de planos | `s02` |
| S3 | Migrations seguras | `CONCURRENTLY` fora de transação | `s03` |
| S4 | Queries/N+1/O(n²) | batch, keyset, agregação incremental | `s04` |
| S5 | MVCC/vacuum/bloat | medir dead tuples, `fillfactor` | `s05` |
| S6 | Transações/locks | `FOR UPDATE`, `SKIP LOCKED`, advisory lock | `s06` |
| S7 | Fila em PG | claim/lease + 2 réplicas | `s07` |
| S8 | pg-boss | schedule durável, `singletonKey`, retry, DLQ | `s08` |
| S9 | Event loop/concorrência | `p-limit`, backpressure, `worker_threads` | `s09` |
| S10 | Broker base | exchange/queue, persistência | `s10` |
| S11 | Prefetch/ack | QoS + ack/nack + timeout | `s11` |
| S12 | Retry/DLQ | TTL + dead-letter, backoff, poison | `s12` |
| S13 | Confirms + dedup | publisher confirms, consumidor idempotente | `s13` |
| S14 | Outbox/idempotência | transactional outbox + crash test | `s14` |
| S15 | Observabilidade | métricas, lag, tracing | `s15` |
| S16 | Profiling/load | k6/autocannon + Clinic.js | `s16` |
| S17 | Pooling | PgBouncer, sizing de conexões | `s17` |
| S18 | Capstone | N réplicas, banco dedicado, decisão | `s18` |

---

## S0 — Setup do ambiente

- **Objetivo:** banco, broker e app de pé, com volume para revelar gargalos.
- **Incremento:** `docker-compose.yml`, projeto TS strict, `/health`,
  `scripts/seed.ts` (1M jobs) e `scripts/bench.ts` (tempo de queries).
- **Validar:** `/health` ok; `SELECT count(*) FROM job` = 1M.
- **Tag:** `s00`.

## S1 — Fundamentos de SQL e modelagem

- **Objetivo:** entender que **FK não cria índice** no Postgres.
- **Incremento:** criar `pipeline(id, payload jsonb, created_at, updated_at)`,
  `job(id, pipeline_id, step, status, run_at, attempts, locked_until,
  locked_by, created_at, updated_at)` e
  `execution(id, job_id, status, output jsonb, started_at, finished_at)` via
  migration, com FKs e **sem índice extra**; `seed.ts` insere 340k pipelines
  (payload = linha do CSV NYC 311) e 3 jobs (`normalize`, `enrich`, `classify`)
  por pipeline.
- **Validar:** `EXPLAIN (ANALYZE, BUFFERS)` mostra **Seq Scan** em `job`.
- **Tag:** `s01`.

## S2 — Indexação e `EXPLAIN` (o tema mais importante)

- **Objetivo:** transformar leitura lenta em rápida sob volume.
- **Incremento:** `job(pipeline_id, status)` / `job(pipeline_id, step)`;
  `execution(job_id, started_at)`;
  `job(status, run_at) WHERE status IN ('pending','failed')` (parcial);
  instalar `pg_stat_statements`.
- **Validar:** Seq Scan → Index Scan/Bitmap; queda de `total_exec_time`;
  registrar planos antes/depois.
- **Tag:** `s02`.

## S3 — Migrations seguras

- **Objetivo:** aplicar schema em produção sem downtime.
- **Incremento:** migration aditiva/reversível com `CREATE INDEX CONCURRENTLY`
  **fora de transação** (`transaction = false`); testar aplicar/reverter;
  simular falha e limpar índice `INVALID`.
- **Validar:** aplica sem lock longo; índice válido; revert ok.
- **Tag:** `s03`.

## S4 — Padrões de query, N+1 e O(n²)

- **Objetivo:** matar custo quadrático.
- **Incremento:** trocar N+1 por `JOIN`/`IN`; paginação por **keyset** no lugar
  de `OFFSET`; agregação **incremental** (`UPDATE ... SET total = total + $1`)
  no lugar de `SUM` do histórico.
- **Validar:** nº de queries por job **constante** conforme o histórico cresce.
- **Tag:** `s04`.

## S5 — MVCC, vacuum, bloat e HOT updates

- **Objetivo:** manter a tabela saudável sob updates frequentes de `status`.
- **Incremento:** gerar update em massa; medir tamanho de tabela/índice e
  `n_dead_tup`; recriar com `fillfactor=80` e comparar.
- **Validar:** `pg_stat_user_tables` (dead tuples, seq scan) e bloat antes/depois.
- **Tag:** `s05`.

## S6 — Transações, isolamento, locks e deadlocks

- **Objetivo:** concorrência correta entre réplicas.
- **Incremento:** scripts demonstrando `FOR UPDATE` esperando, `FOR UPDATE SKIP
  LOCKED` pulando, um deadlock intencional e um `pg_try_advisory_lock`.
- **Validar:** contenção visível em `pg_locks`; `SKIP LOCKED` não bloqueia.
- **Tag:** `s06`.

## S7 — Construir a fila em Postgres (`SKIP LOCKED` + lease)

- **Objetivo:** o coração do motor — fila persistida sem duplicar trabalho.
- **Incremento:** `claimJobs(limit)` com `FOR UPDATE SKIP LOCKED` +
  `UPDATE ... SET locked_until = now() + interval`; worker marca
  `succeeded`/`failed`; sweeper devolve lease vencido; rodar com **2 réplicas**.
- **Validar:** nenhum job processado duas vezes; job de worker morto recuperado.
- **Tag:** `s07`.

## S8 — `pg-boss`: agendamento durável

- **Objetivo:** substituir o cron frágil por agendamento no banco.
- **Incremento:** `send('execute', payload, { startAfter, singletonKey })`;
  `retryLimit`/`retryBackoff`/`expireInSeconds`; DLQ; teste de corrida do
  `singletonKey`.
- **Validar:** ocorrência futura dispara no horário; sem perder ocorrência.
- **Tag:** `s08`.

## S9 — Event loop e concorrência no Node

- **Objetivo:** não travar o processo nem puxar trabalho infinito.
- **Incremento:** trocar `for` sequencial por `p-limit(N)`; tarefa CPU-bound
  fake travando o loop; mover para `worker_threads`.
- **Validar:** throughput sobe com `p-limit`; `/health` degrada com CPU-bound e
  volta com worker thread.
- **Tag:** `s09`.

## S10 — Broker — conceitos base

- **Objetivo:** desacoplar quem produz de quem processa.
- **Incremento:** publicar jobs prontos numa fila `jobs` e consumir; mensagem
  persistente + fila durable; derrubar o broker no meio e observar.
- **Validar:** mensagem sobrevive a restart do broker.
- **Tag:** `s10`.

## S11 — Prefetch/QoS, ack/nack e redelivery

- **Objetivo:** backpressure de verdade no consumidor.
- **Incremento:** consumir sem prefetch (medir memória/unacked) e depois com
  `prefetch(10)`; `noAck:false` + `ack`/`nack(requeue)`.
- **Validar:** sem prefetch, `unacked` e memória sobem; com prefetch, estável.
- **Tag:** `s11`.

## S12 — Retry, backoff, DLQ e poison message

- **Objetivo:** falhar sem hot-loop.
- **Incremento:** fila `jobs_retry` com `x-message-ttl`/`expiration` e header
  `x-retry`; `jobs_dlq`; backoff exponencial; classificar transitório vs poison.
- **Validar:** falha transitória volta após backoff; poison vai para DLQ sem loop.
- **Tag:** `s12`.

## S13 — Publisher confirms, quorum e consumidor idempotente

- **Objetivo:** "publiquei" = "chegou" e reentrega não duplica efeito.
- **Incremento:** `confirm channel` + `waitForConfirms`; tabela
  `processed(execution_id unique)` com consumidor que ignora duplicata;
  reentregar a mesma mensagem de propósito.
- **Validar:** `waitForConfirms` ok; segunda entrega descartada sem efeito.
- **Tag:** `s13`.

## S14 — Semântica de entrega, outbox e idempotência

- **Objetivo:** conciliar o banco (fonte de verdade) com a fila.
- **Incremento:** na transação que cria a `execution`, gravar
  `outbox(payload, sent_at null, attempts)`; drenador publica e marca `sent_at`;
  testar crash entre os dois passos.
- **Validar:** crash simulado não perde nem duplica (com dedup).
- **Tag:** `s14`.

## S15 — Observabilidade

- **Objetivo:** enxergar a fila acumular e drenar.
- **Incremento:** `/metrics` com `outbox_pending`, `outbox_oldest_age_seconds`,
  `jobs_processed_total`, `job_duration_seconds` (histograma); painel simples.
- **Validar:** dá para ver profundidade, idade do mais antigo e lag.
- **Tag:** `s15`.

## S16 — Profiling e load testing

- **Objetivo:** transformar "acho que melhorou" em número.
- **Incremento:** `scripts/bench.ts` rodando o mesmo cenário nas tags `s02`,
  `s07`, `s11`; `autocannon`/`k6`; `clinic doctor/flame`; p50/p95/p99.
- **Validar:** gráfico antes/depois por etapa; p99 cai.
- **Tag:** `s16`.

## S17 — Pooling e limites de conexão

- **Objetivo:** escalar workers sem esgotar conexões.
- **Incremento:** subir PgBouncer (descomentar no compose), apontar o PoC para
  ele, medir com `max_connections` baixo e 2 réplicas.
- **Validar:** sem PgBouncer estoura `too many connections`; com ele, estável.
- **Tag:** `s17`.

## S18 — Capstone: escala, isolamento e banco dedicado

- **Objetivo:** decidir com dados.
- **Incremento:** 3 réplicas do worker com `SKIP LOCKED`; advisory lock para
  jobs singleton; comparar throughput/cauda com banco compartilhado vs dois
  bancos (um para o motor).
- **Validar:** throughput escala com réplicas; números para decidir isolamento.
- **Tag:** `s18`.

---

## Critérios de conclusão da trilha

1. PoC roda com 1M jobs e **N réplicas** sem duplicar nem perder trabalho.
2. As tags `s02`, `s03`, `s07`, `s11`, `s16` têm **medição antes/depois** em `docs/`.
3. Você explica, com seus números, **onde estava o tempo** e **o que cada
   incremento tirou**.
