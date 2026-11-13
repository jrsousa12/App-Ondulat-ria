# Diretrizes de Eficiência de Contexto e Tokens

Este projeto prioriza a economia de contexto e tokens. Toda interação deve seguir as regras abaixo para garantir que o plano de uso do Claude não seja esgotado desnecessariamente. Estas diretrizes são de cumprimento obrigatório.

## 0. Contexto do Projeto

- **Stack**: PWA estático: HTML + CSS + JavaScript puro (ES modules), sem framework, sem build e sem servidor. Dados em `dados/*.json`. Offline via `sw.js`. Publicado no GitHub Pages.
- **Comandos úteis**:
  - Rodar localmente: `python -m http.server 8000` (via `file://` não funciona)
  - Testes: `node ferramentas/validar-dados.js` e `node ferramentas/teste-navegador.js` (requer `npm i --no-save playwright@1.48.2`)
  - Lint: `for f in $(find js ferramentas -name '*.js') sw.js; do node --check "$f"; done` (só sintaxe, igual ao CI)
- **Convenções**: código e nomes em português; camelCase em funções e UPPER_SNAKE em constantes; um módulo por tela/responsabilidade. Arquivo novo em `js/` ou `dados/` → incluir na lista do `sw.js` e subir a versão de `CACHE`.

> Mantenha esta seção curta. Regras específicas de domínio vão nos `CLAUDE.md` dos subdiretórios.

---

## 1. Regra de Ouro: Modularização e Limite de Tamanho de Arquivo

- **Limite de Linhas**: Nenhum arquivo de código deve exceder **300 linhas**. O ideal é manter os arquivos abaixo de **200 linhas**.
- **Ação Corretiva**: Se, ao ler um arquivo, você detectar que ele excede esse limite, sua primeira tarefa deve ser **propor um plano de modularização**, dividindo-o em arquivos menores com responsabilidades únicas, antes de fazer qualquer outra edição.
- **Novas Funcionalidades**: Ao criar novas funcionalidades, já as estruture em módulos pequenos, seguindo o princípio da responsabilidade única.

## 2. Hierarquia de Contexto (CLAUDE.md)

- **Estrutura de Dois Níveis**:
  - **`CLAUDE.md` (Raiz)**: Contém apenas regras globais, comandos de build e convenções de projeto.
  - **`CLAUDE.md` (Subdiretórios)**: Crie arquivos `CLAUDE.md` em subpastas chave (ex: `js/`, `css/`, `dados/`) com as convenções específicas daquele domínio. O Claude deve carregar apenas o arquivo da raiz + o do subdiretório em que está trabalhando.
- **Concisão Máxima**: Mantenha cada arquivo `CLAUDE.md` o mais curto possível. Use bullets e seções com cabeçalhos Markdown. Evite parágrafos longos e prosa desnecessária.
- **Exceções Locais**: Se um subdiretório tiver arquivos naturalmente maiores (ex: folhas de estilo grandes), registre a exceção no `CLAUDE.md` daquele subdiretório, não na raiz.

## 3. Estratégia de Edição e Leitura de Código

- **Prefira Edições Cirúrgicas**: Sempre que possível, edite o arquivo existente usando as ferramentas de edição de linha, em vez de reescrevê-lo por completo. Isso evita a geração de tokens desnecessários.
- **Leitura Sob Demanda**: Não leia arquivos inteiros de forma indiscriminada. Leia apenas os arquivos e trechos diretamente relevantes (o usuário pode indicá-los com `@nome_do_arquivo`). Evite varrer o projeto em busca de contexto que não será usado.
- **Plano Antes do Código**: Para tarefas complexas, descreva o plano em passos lógicos (ou um diagrama simples) e valide com o usuário antes de tocar nos arquivos. Isso reduz drasticamente o consumo de tokens em retrabalho.

## 4. Higiene de Comandos e Saída de Terminal

- **Silencie Comandos Barulhentos**: Ao executar comandos de teste, build ou qualquer outro que gere muita saída, utilize flags de silêncio (ex: `--silent`, `-q`) ou redirecione a saída para filtrar apenas o essencial (ex: `| grep -E "(FAIL|PASS|Error)"`).
- **Limite de Output**: A saída de ferramentas e comandos deve ser a mais concisa possível para não inundar o contexto.

## 5. Protocolo de Sessão (Lembretes)

- **Troca de Tarefa**: Se o usuário solicitar uma tarefa completamente não relacionada à anterior, sugira o comando `/clear` para zerar o contexto e economizar cota.
- **Tarefa Longa (Mesmo Assunto)**: Se a conversa sobre uma mesma tarefa estiver muito longa, sugira o uso de `/compact` com um direcionamento (ex: `/compact mantenha as decisões de arquitetura e os arquivos alterados`).

## 6. Protocolo de Monitoramento de Contexto (Vigia)

Você é responsável por monitorar ativamente o crescimento do contexto durante a sessão. Aja como um parceiro atento: avise no momento certo, sem interromper o fluxo à toa.

### Quando alertar
- Ao perceber que um arquivo em edição se aproxima ou ultrapassa **300 linhas**.
- Quando a conversa sobre uma mesma tarefa ficar longa e o histórico começar a acumular muita informação repetida ou já resolvida.
- Quando notar que está relendo arquivos ou trechos que já leu nesta sessão sem necessidade.

### Como alertar
- Seja breve e direto. Nada de parágrafos longos.
- Explique o motivo em uma frase: o que está crescendo e por quê isso importa.
- Sugira a ação mais adequada para o caso:
  - **Mesma tarefa, conversa longa** → `/compact` com direcionamento.
  - **Tarefa concluída ou mudança de assunto** → `/clear`.
  - **Arquivo grande demais** → pausar a edição e propor modularização antes de continuar.

### Exemplo de alerta
> "O arquivo `auth.ts` está com 340 linhas. Antes de continuar editando, sugiro pausarmos e modularizá-lo em `auth/login.ts`, `auth/session.ts` e `auth/validation.ts`. Posso propor a divisão?"

### Regra de ouro
Nunca prossiga editando um arquivo acima do limite sem antes **perguntar** se o usuário quer modularizar ou continuar mesmo assim. A decisão final é sempre do usuário.

---

## 7. Manutenção deste Arquivo

- Este `CLAUDE.md` deve permanecer **abaixo de 200 linhas**. Se crescer além disso, mova seções específicas para os `CLAUDE.md` dos subdiretórios.
- Revise este arquivo a cada mudança estrutural relevante no projeto (nova stack, novo módulo, novo fluxo de build).
