# Exercícios de variáveis de ambiente com dotenv

## Como usar

```powershell
npm install
Copy-Item .env.example .env
Copy-Item .env.example .env.dev
Copy-Item .env.example .env.prod
```

Preencha `API_KEY` nos arquivos locais com um valor apropriado para seu ambiente e ajuste `DB_HOST`. Os arquivos `.env`, `.env.dev` e `.env.prod` são locais e ignorados pelo Git. Neste projeto, eles já foram criados com **valores fictícios** para permitir os testes. O arquivo `.env.example` fica no repositório, sem senha nem chave.

```powershell
npm start             # NODE_ENV ausente: usa .env
npm run start:dev     # usa .env.dev
npm run start:prod    # usa .env.prod
npm run check         # confere os tipos TypeScript
npm run check:env-schema
```

Abra `http://localhost:3000/health` para ver a porta. O módulo [src/config.ts](src/config.ts) escolhe o arquivo, carrega o `dotenv`, valida as variáveis com Joi e exporta os valores já convertidos. [src/app.ts](src/app.ts) só usa esse objeto. Para o segundo validador do exercício 4, veja [src/config-env-schema.ts](src/config-env-schema.ts). `NODE_ENV` aceita `development` ou `production`; se ausente, o projeto usa `.env`. Um valor diferente causa erro.

O ambiente do terminal tem precedência sobre o arquivo (`override` fica no padrão `false`). Isso permite que o servidor receba configurações do ambiente sem depender de um `.env.prod` no deploy. Nunca use a chave fictícia destes arquivos para acessar um serviço real.

## Registro dos exercícios

### 1. Criando e usando `.env`

- **Sintoma:** `database.ts` lia `DB_HOST` antes do carregamento e recebia `undefined`; `PORT + 1` concatenava texto. O código original também imprimia todo o ambiente, inclusive possíveis segredos.
- **Comando executado:** reproduzi a ordem com `node -e` lendo `DB_HOST` antes de `dotenv.config()`; usei `dotenv.parse` no `.env` para conferir `PORT` e `DB_HOST` sem imprimir senha ou chave. Executei `npm start` depois da correção.
- **Resultado esperado:** `DB_HOST=localhost`, porta numérica `3000`, sem segredo no console.
- **Resultado obtido (valor e tipo):** antes do carregamento: `host do banco: undefined`; depois, `porta + 1: 30001` e `tipo da porta: string`. O parser retornou `PORT="3000"` e `DB_HOST="localhost"` (as aspas aqui são da representação JSON; não fazem parte do valor). Após a correção: `banco: localhost; porta: 3000 (number)`.
- **Hipótese:** a leitura ocorreu cedo demais e `process.env` devolveu texto.
- **Como foi investigado:** comparei a leitura antes/depois de `dotenv.config()` e inspecionei os valores analisados do arquivo. A reprodução evitou a linha original que imprime `process.env` inteiro, pois ela exporia segredos.
- **Causa encontrada:** imports executam antes do corpo de `app.ts`; carregar `dotenv` depois do import de `database.ts` é tarde. Espaços ao redor do `=` são removidos pelo `dotenv`; aspas externas delimitam o texto e também são removidas. A porta ainda é uma string até ser validada e convertida.
- **Como a correção foi validada:** `npm start` carregou `.env`, exibiu só ambiente, arquivo, banco e porta; `GET /health` devolveu `{"ok":true,"port":3000}`. A conversão acontece uma vez em `config.ts`.

**Respostas:** variáveis de ambiente chegam como texto porque o ambiente do processo armazena pares de texto. Se o módulo lê antes do `dotenv`, o valor já capturado não muda sozinho. Imprimir `process.env` revela chaves, senhas e outras informações do sistema. Um módulo único evita leituras em momentos diferentes e fornece tipos validados ao restante da aplicação. Comentários em `.env` com valores reais antigos também podem revelar segredos se o arquivo for compartilhado ou copiado.

### 2. Separando ambientes

- **Sintoma:** o exemplo original podia usar o banco de `.env` mesmo após tentar carregar `.env.prod`; a sintaxe `NODE_ENV=... comando` não funciona no terminal padrão do Windows.
- **Comando executado:** reproduzi com `node -e` carregando `.env` e em seguida `.env.prod` sem `override`. Depois rodei `npm run start:dev`, `npm run start:prod`, `npm --prefix .\env run start:dev` a partir da pasta acima e `npx cross-env NODE_ENV=staging npm start`.
- **Resultado esperado:** cada script escolhe seu arquivo; ambiente inválido falha; o caminho independe da pasta de execução.
- **Resultado obtido (valor e tipo):** na reprodução defeituosa, `ambiente: production banco: localhost`. Corrigido: desenvolvimento mostrou `arquivo: .env.dev; banco: localhost; porta: 3000 (number)`; produção mostrou `arquivo: .env.prod; banco: db.exemplo.invalid; porta: 3000 (number)`. Da pasta acima, `.env.dev` também foi encontrado. `staging` falhou com `NODE_ENV inválida`.
- **Hipótese:** o primeiro carregamento preenchia `DB_HOST` e o próximo não sobrescrevia; a escolha do ambiente e o caminho também estavam errados.
- **Como foi investigado:** observei o banco após dois carregamentos, comparei os scripts e executei a partir de outra pasta.
- **Causa encontrada:** `if (env = 'production')` atribui uma string não vazia e a condição fica verdadeira. `dotenv.config()` inicial lê `.env`; por padrão, outra chamada não substitui uma variável existente. Um caminho relativo depende da pasta atual.
- **Como a correção foi validada:** `config.ts` decide o ambiente antes de carregar **um único** arquivo, resolve o caminho a partir de `__dirname` e os scripts usam `cross-env`. Sem `NODE_ENV`, `npm start` usa `.env`.

**Respostas:** a variável do terminal vence a do arquivo neste projeto, pois `override` é `false`. Em produção, plataformas normalmente entregam as variáveis diretamente ao processo; assim, o arquivo pode não existir. Uma atribuição em `if` devolve o valor atribuído; `'production'` é verdadeiro. Ancorar o caminho no projeto evita depender da pasta de execução. Sobrescrever o terminal só faz sentido quando o arquivo foi escolhido como fonte deliberadamente mais forte, por exemplo em um teste isolado; não é a decisão deste projeto.

### 3. Segurança no Git

- **Sintoma:** no exemplo, `.env` continuava modificado apesar do `.gitignore`, enquanto `.env.example` era ignorado.
- **Comando executado:** `git init`, `git check-ignore -v .env .env.dev .env.prod .env.example`, `git check-ignore -q .env.example`, `git ls-files` e busca no histórico com `git log --all -G 'API_KEY=.+|DB_PASSWORD=.+' -- .env .env.dev .env.prod .env.example`.
- **Resultado esperado:** arquivos locais ignorados, exemplo rastreado e nenhum segredo real no histórico.
- **Resultado obtido (valor e tipo):** `.env` combinou com `.gitignore:3:.env`; `.env.dev` e `.env.prod` com `.gitignore:4:.env.*`; `.env.example` combinou com a exceção `!.env.example` e `git check-ignore -q` retornou código `1` (não ignorado). O repositório começou vazio: nenhum `.env` estava rastreado para remover do índice.
- **Hipótese:** `.gitignore` não remove arquivos já rastreados e o padrão amplo também atingia o exemplo.
- **Como foi investigado:** conferi padrões com `git check-ignore`, índice com `git ls-files` e histórico com `git log`.
- **Causa encontrada:** o Git aplica `.gitignore` apenas a arquivos ainda não rastreados. O padrão `.env*` também cobre `.env.example`.
- **Como a correção foi validada:** `.gitignore` usa `.env`, `.env.*` e `!.env.example`; o exemplo contém apenas valores ilustrativos. Se um `.env` **já estivesse rastreado**, o comando seria `git rm --cached .env` seguido de commit; aqui não foi necessário porque o repositório era novo.

**Respostas:** apagar ou parar de rastrear o arquivo não apaga commits antigos. Uma chave exposta deve ser revogada/rotacionada no provedor e substituída onde for usada; remover o texto do código não impede o uso da chave antiga. O `.env.example` informa as variáveis necessárias ao novo integrante, que o copia para seus arquivos locais e preenche os valores. No servidor, os segredos devem vir do ambiente ou do gerenciador de segredos da plataforma.

### 4. Variáveis obrigatórias

- **Sintoma:** o schema incompleto aceitava ausência de `API_KEY` e a aplicação continuava após um aviso.
- **Comando executado:** reproduzi o schema original com um objeto vazio: `erro: undefined aplicacao continua: true`. Depois executei `npx cross-env API_KEY= npm start`, `npx cross-env DB_HOST= API_KEY= npm start`, `npx cross-env PORT=abc npm start`, `npm run check:env-schema` e os mesmos casos inválidos com `check:env-schema`.
- **Resultado esperado:** falhar antes de abrir a porta, listar todas as variáveis inválidas e entregar `PORT` como número quando válida.
- **Resultado obtido (valor e tipo):** `API_KEY=` falhou com `Configuração inválida: API_KEY.`; `DB_HOST= API_KEY=` listou as duas; `PORT=abc` listou `PORT`. Todos saíram com código `1`. Com valores válidos, `PORT` foi `3000 (number)`. O exemplo com `env-schema` também listou `DB_HOST, API_KEY` e `PORT` nos respectivos testes.
- **Hipótese:** as chaves eram opcionais por padrão e `console.warn` não interrompia a inicialização.
- **Como foi investigado:** validei um objeto vazio com o schema original, depois comparei execução válida, valores vazios e porta inválida.
- **Causa encontrada:** `Joi.string()` sem `.required()` permite ausência; aviso não encerra o processo; reler `process.env` descarta a conversão feita pelo validador.
- **Como a correção foi validada:** `config.ts` usa `.required()`, valida todos os erros com `abortEarly: false`, aceita variáveis extras com `.unknown(true)` e exporta o objeto convertido. A variante `env-schema` usa `required`, `minLength` e limites numéricos em JSON Schema.

**Respostas:** falhar na subida impede que a primeira requisição encontre uma configuração quebrada. Ausente significa que a chave não existe; vazia significa que existe com `''`, mas também é inválida para `API_KEY` e `DB_HOST`. Mensagens de erro mostram somente nomes para não expor valores. Rejeitar variáveis desconhecidas do sistema poderia barrar chaves normais do Node, do terminal ou da hospedagem. O objeto validado concentra as conversões e evita divergência entre partes do código. Joi usa uma API encadeada; `env-schema` usa JSON Schema e retorna só as propriedades declaradas. Ambos foram testados com entradas válidas e inválidas.

### 5. Porta com fallback

- **Sintoma:** o código original usava 3000 silenciosamente com `PORT=''`; a segunda instância falhava sem mensagem clara.
- **Comando executado:** comparei `'' || 3000` com `'' ?? 3000`; removi temporariamente `PORT` de `.env` e rodei `npm start`; rodei `npx cross-env PORT=4000 npm start`, `npx cross-env PORT= npm start`, `npx cross-env PORT=abc npm start` e duas instâncias de `npm run start:dev` na mesma porta.
- **Resultado esperado:** ausência usa 3000; 4000 funciona; vazia/inválida falha; porta ocupada mostra `EADDRINUSE` e código de saída `1`.
- **Resultado obtido (valor e tipo):** sem `PORT`, `/health` devolveu `{"ok":true,"port":3000}`. Com `PORT=4000`, devolveu `{"ok":true,"port":4000}` e o console mostrou `porta: 4000 (number)`. `PORT=` e `PORT=abc` produziram `Configuração inválida: PORT.`. A segunda instância mostrou `Porta 3000 já está em uso (EADDRINUSE).` e saiu com código `1`.
- **Hipótese:** `||` trata string vazia como falsa e a falha de `listen` chega por evento de erro.
- **Como foi investigado:** conferi os dois operadores com a mesma string vazia, consultei `/health` e observei a saída/código da segunda instância.
- **Causa encontrada:** `'' || 3000` resulta em `3000`, enquanto `'' ?? 3000` preserva `''`. A porta precisa ser convertida e validada; o servidor emite `EADDRINUSE` se a porta já estiver ocupada.
- **Como a correção foi validada:** Joi aceita apenas porta inteira entre 1 e 65535; o padrão 3000 vale só quando `PORT` está ausente. O callback de `listen` consulta `server.address()` e anuncia a porta real somente após sucesso. O evento `error` informa a porta ocupada e define código de saída `1`. O `.env` foi restaurado após o teste sem `PORT`.

**Respostas:** `||` usa o padrão para qualquer valor falso, inclusive `''`; `??` só para `null` e `undefined`. Consultar `server.address()` confirma onde o servidor realmente escuta. Em produção, quando a plataforma exige uma porta específica, pode ser mais seguro tornar `PORT` obrigatória em vez de usar fallback. Código de saída diferente de zero informa ao terminal e ao gerenciador de processos que a inicialização falhou.

## Git e segredos

Se algum segredo real já foi enviado ao Git, revogue-o e crie outro. Depois, remova o arquivo do índice com `git rm --cached .env` e trate o histórico conforme a política do repositório. Uma busca útil é:

```powershell
git log --all -G 'API_KEY=.+|DB_PASSWORD=.+' -- .env .env.dev .env.prod .env.example
```

Essa busca procura linhas com valores nas chaves indicadas; ela não substitui uma auditoria completa de segredos em todos os arquivos. Não coloque chaves reais em exemplos, comentários, comandos ou mensagens de commit.
