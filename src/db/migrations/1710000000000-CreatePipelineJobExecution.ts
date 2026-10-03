import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePipelineJobExecution1710000000000 implements MigrationInterface {
  name = 'CreatePipelineJobExecution1710000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "pipeline" (
        "id" bigint NOT NULL,
        "payload" jsonb NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_pipeline" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "job" (
        "id" bigint GENERATED ALWAYS AS IDENTITY,
        "pipeline_id" bigint NOT NULL,
        "step" text NOT NULL,
        "status" text NOT NULL,
        "run_at" timestamptz NOT NULL DEFAULT now(),
        "attempts" integer NOT NULL DEFAULT 0,
        "locked_until" timestamptz,
        "locked_by" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_job" PRIMARY KEY ("id"),
        CONSTRAINT "FK_job_pipeline" FOREIGN KEY ("pipeline_id")
          REFERENCES "pipeline" ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "execution" (
        "id" bigint GENERATED ALWAYS AS IDENTITY,
        "job_id" bigint NOT NULL,
        "status" text NOT NULL,
        "output" jsonb,
        "started_at" timestamptz,
        "finished_at" timestamptz,
        CONSTRAINT "PK_execution" PRIMARY KEY ("id"),
        CONSTRAINT "FK_execution_job" FOREIGN KEY ("job_id")
          REFERENCES "job" ("id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "execution"`);
    await queryRunner.query(`DROP TABLE "job"`);
    await queryRunner.query(`DROP TABLE "pipeline"`);
  }
}
