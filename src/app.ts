import express from 'express';
import { config } from './config';

const app = express();

app.get('/health', (_request, response) => {
  response.json({ ok: true, port: config.port });
});

const server = app.listen(config.port, (error?: Error) => {
  if (error) return;
  const address = server.address();
  const port = address && typeof address !== 'string' ? address.port : config.port;
  console.log(`Ambiente: ${config.environment}; arquivo: ${config.file}; banco: ${config.dbHost}; porta: ${port} (${typeof config.port})`);
});

server.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Porta ${config.port} já está em uso (EADDRINUSE).`);
  } else {
    console.error(`Falha ao iniciar o servidor: ${error.code ?? 'erro desconhecido'}.`);
  }
  process.exitCode = 1;
});
