import 'reflect-metadata';
import { AppDataSource } from '../src/db/data-source';

async function main(): Promise<void> {
  await AppDataSource.initialize();
  console.log('bench: TODO: S0/S16');
  await AppDataSource.destroy();
}

void main();
