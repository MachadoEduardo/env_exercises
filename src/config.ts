import path from 'node:path';
import dotenv from 'dotenv';
import Joi from 'joi';

const environment = process.env.NODE_ENV ?? 'local';
if (!['local', 'development', 'production'].includes(environment)) {
  throw new Error('NODE_ENV inválida: use development ou production.');
}

const file = environment === 'local' ? '.env' : environment === 'development' ? '.env.dev' : '.env.prod';
dotenv.config({ path: path.resolve(__dirname, '..', file), quiet: true });

const schema = Joi.object({
  DB_HOST: Joi.string().trim().required(),
  API_KEY: Joi.string().trim().required(),
  PORT: Joi.number().integer().min(1).max(65535).default(3000)
}).unknown(true);

const { value, error } = schema.validate(process.env, { abortEarly: false });
if (error) {
  const names = [...new Set(error.details.map(detail => String(detail.path[0])))];
  throw new Error(`Configuração inválida: ${names.join(', ')}.`);
}

export const config = {
  environment,
  file,
  dbHost: value.DB_HOST as string,
  apiKey: value.API_KEY as string,
  port: value.PORT as number
};
