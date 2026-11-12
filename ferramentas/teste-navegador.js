#!/usr/bin/env node
/* Teste de ponta a ponta no Chromium (Playwright).
   Uso: node ferramentas/teste-navegador.js
   Requer: npm i -D playwright (ou o Playwright já instalado na máquina). */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const RAIZ = path.join(__dirname, '..');
const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };

function servidor() {
  return new Promise(resolve => {
    const srv = http.createServer((req, res) => {
      const url = decodeURIComponent(req.url.split('?')[0]);
      const arq = path.join(RAIZ, url === '/' ? 'index.html' : url);
      if (!arq.startsWith(RAIZ) || !fs.existsSync(arq) || fs.statSync(arq).isDirectory()) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': TIPOS[path.extname(arq)] || 'application/octet-stream' });
      fs.createReadStream(arq).pipe(res);
    });
    srv.listen(0, () => resolve(srv));
  });
}

const banco = id => JSON.parse(fs.readFileSync(path.join(RAIZ, 'dados', `questoes-trilha-${id}.json`), 'utf8')).questoes;
const trilha = id => JSON.parse(fs.readFileSync(path.join(RAIZ, 'dados', `trilha-${id}.json`), 'utf8'));

let falhas = 0;
function confere(cond, msg) {
  if (cond) console.log('  ✓ ' + msg);
  else { console.error('  ✗ ' + msg); falhas++; }
}

(async () => {
  const srv = await servidor();
  const base = `http://localhost:${srv.address().port}`;
  const navegador = await chromium.launch();
  const pagina = await navegador.newPage({ viewport: { width: 390, height: 844 } });
  const erros = [];
  pagina.on('pageerror', e => erros.push(e.message));
  pagina.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });
  // O único diálogo nativo esperado é o aviso de saída (beforeunload); alert/confirm/prompt contam como erro.
  pagina.on('dialog', d => {
    if (d.type() === 'beforeunload') return d.accept();
    erros.push('diálogo nativo: ' + d.message());
    return d.dismiss();
  });

  try {
    console.log('Cadastro');
    await pagina.goto(base + '/index.html');
    await pagina.click('#onb-avancar');
    await pagina.fill('#in-nome', 'Teste');
    await pagina.fill('#in-sobrenome', 'Automático');
    await pagina.fill('#in-turma', '9Z');
    await pagina.click('#form-onboarding button[type=submit]');
    await pagina.click('[data-avatar="🦉"]');
    await pagina.click('#onb-fim');
    await pagina.waitForSelector('.home-hero');
    confere((await pagina.textContent('.home-saudacao')).includes('🦉'), 'avatar escolhido aparece na tela inicial');
    confere((await pagina.textContent('#home-ola')).includes('Teste'), 'tela inicial mostra o nome');

    console.log('Telas');
    for (const rota of ['trilhas', 'praticar', 'lab', 'perfil', 'desempenho', 'inicio']) {
      await pagina.evaluate(r => { location.hash = r; }, rota);
      await pagina.waitForTimeout(400);
      confere(erros.length === 0, `#${rota} abre sem erros`);
    }

    console.log('Trilha 1 completa');
    await pagina.evaluate(() => { location.hash = 'trilha/1'; });
    await pagina.waitForSelector('#btn-ir-compreensao');
    await pagina.click('#btn-ir-compreensao');
    for (const p of trilha('1').perguntasCompreensao) {
      await pagina.click(`#alternativas .alternativa >> nth=${p.correta}`);
      await pagina.click('#btn-proxima-comp');
    }
    const questoes = banco('1');
    for (let i = 0; i < 10; i++) {
      await pagina.waitForSelector('.quiz-header');
      const enunciado = (await pagina.textContent('#conteudo h3')).trim();
      const q = questoes.find(x => x.enunciado.trim() === enunciado);
      if (!q) throw new Error('Questão não encontrada no banco: ' + enunciado);
      if (q.tipo === 'verdadeiro_falso') {
        await pagina.click(`#alt-container .alternativa >> text=${q.correta ? 'Verdadeiro' : 'Falso'}`);
      } else if (q.alternativas) {
        const certa = q.alternativas[q.correta];
        const botoes = await pagina.$$('#alt-container .alternativa');
        for (const b of botoes) {
          const norm = t => t.replace(/^[A-F]\)\s*/, '').replace(/[\s/]/g, '');
          if (norm(await b.textContent()) === norm(certa)) { await b.click(); break; }
        }
      } else if (q.tipo === 'associacao') {
        for (let k = 0; k < q.colunaA.length; k++) {
          await pagina.selectOption(`#assoc-${k}`, { label: q.colunaB[q.correta[k]] });
        }
        await pagina.click('#btn-responder-assoc');
      } else if (q.tipo === 'ordenacao') {
        const itens = await pagina.$$('.ord-item');
        for (const it of itens) {
          const nome = (await it.$eval('span', e => e.textContent)).trim();
          await (await it.$('select')).selectOption(String(q.correta.indexOf(nome) + 1));
        }
        await pagina.click('#btn-responder-ord');
      }
      await pagina.click('#btn-proxima-q');
    }
    await pagina.waitForSelector('.resultado-hero');
    confere((await pagina.textContent('.pontuacao')).startsWith('10/10'), 'acertando tudo, o quiz dá 10/10');
    const salvo = await pagina.evaluate(() => JSON.parse(localStorage.getItem('ondulatoria_dados_v1')).dados);
    confere(salvo.trilhas['1'].concluida === true, 'trilha 1 marcada como concluída');
    confere(salvo.historico.length === 1 && Object.keys(salvo.questoes).length === 10, 'histórico e questões registrados');
    confere(salvo.badges.some(b => b.id === 'gabaritou'), 'conquista "Gabaritou" concedida');

    console.log('Treino e caderno de erros');
    async function responderSessao() {
      let n = 0;
      while (await pagina.$('.sessao')) {
        if (await pagina.$('#alt-container .alternativa')) await pagina.click('#alt-container .alternativa >> nth=0');
        else if (await pagina.$('#btn-responder-assoc')) {
          for (const sel of await pagina.$$('#assoc-container select')) await sel.selectOption({ index: 1 });
          await pagina.click('#btn-responder-assoc');
        } else await pagina.click('#btn-responder-ord');
        await pagina.click('#btn-proxima-q');
        n++;
      }
      return n;
    }
    await pagina.evaluate(() => { location.hash = 'praticar/treino'; });
    await pagina.waitForSelector('#btn-adaptativo');
    await pagina.click('#btn-adaptativo');
    const respondidas = await responderSessao();
    await pagina.waitForSelector('.resultado-hero');
    confere(respondidas === 10, 'treino adaptativo tem 10 questões');
    const t1 = await pagina.evaluate(() => JSON.parse(localStorage.getItem('ondulatoria_dados_v1')).dados);
    const placar = (await pagina.textContent('.pontuacao')).match(/(\d+)\/10/);
    const qtdErros = 10 - Number(placar[1]);
    confere(Object.keys(t1.cadernoErros).length === qtdErros, `os ${qtdErros} erros foram para o caderno`);
    confere(t1.treino.xp <= 40, 'XP de treino respeita o limite diário');
    if (qtdErros) {
      await pagina.click('#btn-rever');
      confere(await responderSessao() === qtdErros, '"Rever só as que errei" traz exatamente as erradas');
    }

    console.log('Backup');
    const malicioso = JSON.stringify({ app: 'ondulatoria', para: 'backup', versao: 1, dados: {
      aluno: { primeiroNome: '<img src=x onerror=alert(1)>', ultimoNome: 'X', turma: '1' },
      xp: '9999999999', trilhas: { '1': { concluida: 'sim' }, '99': {} },
      historico: [{ trilha: '1', acertos: '<b>9</b>', total: 10, em: 'x' }], badges: [{ id: 'falso', emoji: '<svg>' }]
    } });
    const importado = await pagina.evaluate(async txt => {
      const m = await import('/js/storage.js');
      return m.storage.importar(txt, 'outro');
    }, malicioso);
    confere(importado && importado.xp === 1000000, 'XP absurdo é limitado');
    confere(importado && !importado.trilhas['99'] && importado.trilhas['1'].concluida === undefined, 'trilhas inválidas são descartadas');
    confere(importado && importado.historico[0].acertos === 0 && importado.badges.length === 0, 'campos com HTML ou desconhecidos são limpos');
    confere(importado && importado.flags.some(f => f.tipo === 'importacao_backup'), 'importação fica registrada');
    const recusado = await pagina.evaluate(async () => (await import('/js/storage.js')).storage.importar('{"dados":{}}'));
    confere(recusado === null, 'arquivo que não é backup é recusado');

    console.log('PIN do professor');
    const pinOk = await pagina.evaluate(async () => (await import('/js/modo-professor.js')).verificarPin('ondas2026'));
    const pinErrado = await pagina.evaluate(async () => (await import('/js/modo-professor.js')).verificarPin('errado'));
    confere(pinOk.ok === true && pinErrado.ok === false, 'PIN confere pelo hash');

    console.log('Saída');
    await pagina.goto('about:blank');
    await pagina.goto(base + '/index.html');
    await pagina.waitForSelector('.home-hero');
    await pagina.click('a.nav-item[href="#trilhas"]');
    await pagina.waitForTimeout(200);
    await pagina.goBack();
    await pagina.waitForTimeout(200);
    await pagina.goBack();
    await pagina.waitForSelector('dialog.modal[open]', { timeout: 3000 });
    confere(true, 'voltar na primeira tela pergunta se quer sair');
    await pagina.click('dialog.modal [data-r="0"]');
    await pagina.waitForTimeout(200);
    confere(pagina.url().startsWith(base), 'Cancelar mantém no app');

    console.log('Ferramenta do professor');
    await pagina.goto(base + '/professor.html');
    await pagina.waitForTimeout(500);
    confere(await pagina.isVisible('#form-pin'), 'professor.html abre');

    confere(erros.length === 0, 'nenhum erro no console' + (erros.length ? ': ' + erros.join(' | ') : ''));
  } catch (e) {
    console.error(e);
    falhas++;
  } finally {
    await navegador.close();
    srv.close();
  }
  console.log(falhas ? `\n${falhas} falha(s)` : '\nTudo certo');
  process.exit(falhas ? 1 : 0);
})();
