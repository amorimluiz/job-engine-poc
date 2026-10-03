import 'reflect-metadata';
import { AppDataSource } from '../src/db/data-source';

async function main(): Promise<void> {
  await AppDataSource.initialize();
  console.log('seed: TODO: S0/S1');
  await AppDataSource.destroy();
}

void main();
