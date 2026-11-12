# Ondulatória — 9º ano

Aplicativo de estudo gamificado sobre ondas e som. Funciona no navegador, pode ser instalado no celular e abre sem internet depois da primeira visita. Não tem servidor: o progresso de cada aluno fica no próprio aparelho.

## O que o app tem

- **6 trilhas** (leitura → 3 perguntas de compreensão → quiz de 10 questões). Acertar 80% libera a próxima.
- **Praticar**
  - **Treino adaptativo**: 10 questões escolhidas pelo histórico do aluno, com a opção de incluir questões de aprofundamento.
  - **Caderno de erros**: toda questão errada entra no caderno e sai depois de 2 acertos seguidos.
  - **Desafio cronometrado**: 20 s por questão, com recorde.
  - **Flashcards** com revisão espaçada, **diário sonoro** e **atividades abertas**, que o professor avalia.
- **Laboratório**: osciloscópio com som, comparação de meios, ressonância, fenômeno animado com gráfico (eco, trovão, período) e microfone.
- **Meu desempenho**: aproveitamento, evolução nos quizzes, acertos por conceito e próximos passos.
- **Ficha da aula** para imprimir de cada trilha (`#ficha/1` a `#ficha/6`), com gabarito.
- XP, níveis, 12 conquistas, avatar, tema claro e escuro, tamanho do texto, sons e vibração opcionais.
- **Vários alunos no mesmo aparelho** (Perfil → Alunos neste aparelho).

## Publicar (GitHub Pages)

1. Em **Settings → Pages**, escolha `Deploy from a branch`, branch `main`, pasta `/ (root)`.
2. O endereço fica `https://SEU-USUARIO.github.io/App-Ondulat-ria/`.
3. Os alunos abrem esse endereço no celular e tocam em **Perfil → Aplicativo → Instalar na tela inicial**. No iPhone, o caminho é **Compartilhar → Adicionar à Tela de Início**.

Abrir o `index.html` direto do computador (`file://`) não funciona. Para testar localmente, rode `python -m http.server 8000` na pasta e acesse `http://localhost:8000`.

**Atualizações:** o app usa a cópia guardada e baixa a versão nova em segundo plano. Quem abrir o app com internet vê a versão nova na **abertura seguinte**. Se você criar um arquivo novo em `js/` ou `dados/`, acrescente-o na lista do `sw.js`; o validador avisa se faltar algum.

## Ferramenta do professor (`professor.html`)

1. **Chave de envio:** clique em *Gerar novo par de chaves*.
   - Guarde a chave privada baixada (pendrive e backup).
   - Substitua `js/chave-publica.js` pelo arquivo gerado.
   - Com isso, os alunos passam a gerar em Perfil um arquivo cifrado que só você abre.
2. **Decifrar relatórios:** importe a chave privada e selecione os arquivos dos alunos. Dá para exportar tudo em CSV, com a nota de cada trilha.
3. **PIN do modo professor:** o modo professor é aberto com 7 toques no logotipo e mostra as explicações durante o quiz. Para trocar o PIN, gere um `pin-professor.js` novo e substitua o que está em `js/`. O PIN fica só como hash.

> **Troque o PIN padrão** (é o mesmo da versão anterior do app) antes de usar com a turma.

**Limites honestos:**
- O app não tem servidor. Por isso o PIN e a verificação de integridade **dificultam** a fraude, mas não a **impedem**.
- Use os registros de comportamento como pistas: troca de aba durante o quiz, respostas rápidas demais e importação de backup.

## Conferências automáticas

```bash
node ferramentas/validar-dados.js          # confere trilhas, questões, flashcards e a lista do sw.js
npm i --no-save playwright@1.48.2 && npx playwright install chromium
node ferramentas/teste-navegador.js        # percorre o app de ponta a ponta no Chromium
```

As duas rodam sozinhas no GitHub a cada envio (aba **Actions**). Um ❌ vermelho indica o que quebrou.

## Acrescentar ou corrigir questões

- Questões das trilhas: `dados/questoes-trilha-N.json`.
  - Tipos: `multipla_escolha`, `verdadeiro_falso`, `associacao`, `ordenacao`, `calculo_guiado`, `predicao`, `aberta` e `analise_erro`.
- Questões extras do Treino: `dados/questoes-extra.json`.
  - Vieram da Plataforma de Física.
  - Têm `dica`, `feedbackErro` (comentário para cada alternativa errada) e `nivel` (`basico` ou `aprofundamento`).
- Escrever `a / b`, com espaços, mostra a divisão como fração.
- Depois de editar, rode `node ferramentas/validar-dados.js`.

## Estrutura

| Pasta/arquivo | Para que serve |
|---|---|
| `index.html`, `css/estilo.css` | App do aluno |
| `js/app.js` | Navegação entre telas |
| `js/inicio.js`, `js/lista-trilhas.js`, `js/trilhas.js`, `js/praticar.js`, `js/treino.js`, `js/lab.js`, `js/perfil.js`, `js/desempenho.js`, `js/ficha.js`, `js/fontes.js`, `js/onboarding.js` | Telas |
| `js/quiz.js`, `js/registro.js`, `js/progresso.js` | Motor de questões, caderno de erros e regras de progresso |
| `js/storage.js` | Dados no aparelho, validação de backup e vários alunos |
| `js/dialogos.js`, `js/ui.js`, `js/fx.js`, `js/preferencias.js`, `js/pwa.js` | Diálogos, peças visuais, efeitos, preferências e instalação |
| `js/crypto.js`, `js/relatorio.js`, `js/modo-professor.js`, `js/pin-professor.js`, `js/chave-publica.js` | Envio cifrado ao professor e modo professor |
| `professor.html`, `js/professor.js`, `css/professor.css` | Ferramenta do professor |
| `dados/` | Textos, questões e flashcards |
| `sw.js`, `manifest.webmanifest`, `icones/` | Instalação e uso sem internet |
| `ferramentas/` | Validador e teste de ponta a ponta |

## Privacidade (LGPD)

- O app guarda nome, turma e progresso **somente no aparelho**.
- Nada é enviado a servidores.
- O professor recebe apenas o arquivo cifrado que o aluno decidir gerar.
- Avise a escola e as famílias sobre esse uso.
