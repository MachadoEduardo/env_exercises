import path from 'node:path';
import dotenv from 'dotenv';
import envSchema from 'env-schema';

const environment = process.env.NODE_ENV ?? 'local';
if (!['local', 'development', 'production'].includes(environment)) {
  throw new Error('NODE_ENV inválida: use development ou production.');
}
const file = environment === 'local' ? '.env' : environment === 'development' ? '.env.dev' : '.env.prod';
dotenv.config({ path: path.resolve(__dirname, '..', file), quiet: true });

const schema = {
  type: 'object',
  required: ['DB_HOST', 'API_KEY'],
  properties: {
    DB_HOST: { type: 'string', minLength: 1 },
    API_KEY: { type: 'string', minLength: 1 },
    PORT: { type: 'integer', minimum: 1, maximum: 65535, default: 3000 }
  }
} as const;

try {
  const value = envSchema<{ DB_HOST: string; API_KEY: string; PORT: number }>({ schema, data: process.env });
  console.log(`env-schema: banco=${value.DB_HOST}; porta=${value.PORT} (${typeof value.PORT}); API_KEY=presente`);
} catch (error) {
  type ValidationError = { errors?: Array<{ keyword: string; instancePath: string; params: { missingProperty?: string } }> };
  const details = (error as ValidationError).errors ?? [];
  const names = [...new Set(details.map(detail =>
    detail.keyword === 'required' ? detail.params.missingProperty : detail.instancePath.slice(1)
  ).filter((name): name is string => ['DB_HOST', 'API_KEY', 'PORT'].includes(name ?? '')))];
  console.error(`Configuração inválida (env-schema): ${names.join(', ') || 'verifique as variáveis'}.`);
  process.exitCode = 1;
}
