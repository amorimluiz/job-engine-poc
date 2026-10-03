import { MigrationInterface, QueryRunner } from "typeorm";

export class AddedJobIndexes1791050318256 implements MigrationInterface {
    name = 'AddedJobIndexes1791050318256'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE INDEX "job_pipeline_id_idx" ON "job" ("pipeline_id") `);
        await queryRunner.query(`CREATE INDEX "job_run_at_desc_pending_id" ON "job" ("run_at" DESC) WHERE status = 'pending'`);
        await queryRunner.query(`CREATE INDEX "job_pipeline_id_pending_idx" ON "job" ("pipeline_id") WHERE status = 'pending'`);
        await queryRunner.query(`CREATE INDEX "execution_job_id_idx" ON "execution" ("job_id") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."execution_job_id_idx"`);
        await queryRunner.query(`DROP INDEX "public"."job_pipeline_id_pending_idx"`);
        await queryRunner.query(`DROP INDEX "public"."job_run_at_desc_pending_id"`);
        await queryRunner.query(`DROP INDEX "public"."job_pipeline_id_idx"`);
    }

}
