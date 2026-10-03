# job-engine-poc

PoC incremental de um **motor de jobs/pipeline para grande volume**, seguindo a
trilha de estudo (`../TRILHA-ESTUDO.md`). Cada etapa S0–S18 é um incremento
sobre este mesmo projeto.

Este repositório está no **S0 (setup)**. As etapas **S1–S18 são feitas pelo
próprio usuário**, uma a uma, como incrementos deste projeto.

## Stack

| Camada | Escolha |
|---|---|
| Runtime | Node 20+ / TypeScript strict |
| HTTP | Express puro |
| Arquitetura | MSC (model, service, controller) |
| Banco | PostgreSQL 16 (Docker) |
| Broker | RabbitMQ 3 (Docker) |
| Acesso a dados | TypeORM 0.3 + SQL cru |

### Sobre a arquitetura MSC

Cada domínio vive em `src/<dominio>/` e, quando ganhar lógica, segue o padrão:

```
src/<dominio>/
  <dominio>.model.ts       # tipos/entidades e formas de dados
  <dominio>.service.ts     # regra de negócio / acesso a dados
  <dominio>.controller.ts  # camada HTTP (Router do Express)
```

O controller expõe um `Router` que é montado em `src/app.ts`. Em S0 apenas o
domínio `health` tem código; `jobs/`, `queue/`, `metrics/` e `worker-fake/`
estão vazios, prontos para as etapas seguintes.

## Subir a infraestrutura

```bash
cp .env.example .env
docker compose up -d
docker compose ps        # postgres e rabbitmq devem estar "healthy"
```

Serviços expostos:

- Postgres: `localhost:5432`
- RabbitMQ AMQP: `localhost:5672`
- RabbitMQ Management UI: http://localhost:15672 (guest/guest)

O `docker compose` **não roda migrations**. O bloco do **PgBouncer está
comentado** e só deve ser ativado no S17.

## Instalar e rodar

```bash
npm install
npm run start:dev        # sobe a app com ts-node
```

Testar o health check (faz `SELECT 1` no Postgres):

```bash
curl -i localhost:3000/health   # HTTP 200
```

Build de produção:

```bash
npm run build            # tsc -> dist/
npm run start            # node dist/src/main.js
```

## Migrations (TypeORM)

```bash
npm run typeorm:migration:generate -- src/db/migrations/NomeDaMigration
npm run typeorm:migration:run
npm run typeorm:migration:revert
```

O `DataSource` fica em `src/db/data-source.ts` (compilado para
`dist/src/db/data-source.js`). Já vem com `synchronize: false` e
`migrationsRun: false`, e sem entidades — as entidades/tabelas entram no S1.

## Scripts de apoio

Ainda são placeholders (S0):

```bash
npx ts-node scripts/seed.ts    # loga "TODO: S0/S1"
npx ts-node scripts/bench.ts   # loga "TODO: S0/S16"
```

## Convenção da trilha: uma etapa S por tag/commit

1. Estude o tema da etapa em `../TRILHA-ESTUDO.md`.
2. Implemente **apenas** o incremento daquela etapa sobre este projeto.
3. Valide o critério da etapa e registre a medição antes/depois em `docs/`.
4. Feche com **commit + tag** (`s01`, `s02`, ... `s18`) para poder comparar e
   voltar.

Exemplo:

```bash
git add .
git commit -m "feat(s01): modelagem sql e medicao de seq scan"
git tag s01
```

## Estrutura

```
job-engine-poc/
  docker-compose.yml          # postgres:16 + rabbitmq:3-management + pgbouncer (comentado)
  src/
    main.ts                   # bootstrap: sobe o servidor
    app.ts                    # cria o app Express e monta os controllers
    db/
      data-source.ts          # DataSource do TypeORM (CLI + scripts)
      migrations/             # vazio (S1+)
    health/                   # unico dominio com codigo no S0 (MSC)
      health.controller.ts
      health.service.ts
    jobs/                     # vazio (S1+)
    queue/                    # vazio (S10+)
    metrics/                  # vazio (S15+)
    worker-fake/              # vazio (S1+)
  scripts/
    seed.ts                   # placeholder
    bench.ts                  # placeholder
```

## Fora de escopo no S0 (entra nas etapas seguintes)

- S1: tabelas `job`/`execution`, seed de 1M e medição de seq scan.
- S2: índices + `EXPLAIN`/`pg_stat_statements`.
- S3: migrations sem downtime (`CREATE INDEX CONCURRENTLY`).
- S4: N+1 e O(n²).
- S5–S6: MVCC/vacuum/bloat e transações/locks.
- S7: fila no Postgres com `SKIP LOCKED` + lease.
- S8: agendamento durável com `pg-boss`.
- S9: event loop e concorrência.
- S10–S13: broker (exchange/queue, prefetch, retry/DLQ, confirms).
- S14–S18: outbox/idempotência, observabilidade, profiling, pooling e escala.

Nada disso está implementado aqui — o S0 é só o esqueleto e a base de medição.
