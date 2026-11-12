/* Tela Perfil: dados do aluno, preferências, conquistas, envio ao professor e backup. */
import { esc } from './utils.js';
import { storage } from './storage.js';
import { AVATARES, TRILHAS } from './conteudo.js';
import { listarTodosBadges } from './badges.js';
import { exportarParaProfessor, chaveConfigurada, fingerprintChave } from './relatorio.js';
import { confirmar, avisar } from './dialogos.js';
import { ICONES, cabecalho } from './ui.js';
import { prefs } from './fx.js';
import { nivel, totalConcluidas, XP_POR_NIVEL } from './progresso.js';
import { aplicarTema, temaAtual, aplicarFonte, fonteAtual } from './preferencias.js';
import { estaInstalado, podeInstalar, instalar, ehIOS, telaCheiaSuportada, alternarTelaCheia, telaCheiaAutomatica, definirTelaCheiaAutomatica, aoMudarInstalacao } from './pwa.js';

function htmlAplicativo() {
  let instalar;
  if (estaInstalado()) instalar = '<p class="perfil-ok">✓ O app já está instalado neste aparelho.</p>';
  else if (podeInstalar()) instalar = '<button class="btn" id="btn-instalar">📲 Instalar na tela inicial</button>';
  else if (ehIOS()) instalar = '<p class="perfil-dica">No iPhone/iPad: toque em <strong>Compartilhar</strong> e depois em <strong>Adicionar à Tela de Início</strong>.</p>';
  else instalar = '<p class="perfil-dica">Para instalar, abra o app pelo endereço https no Chrome ou Edge e use <strong>Instalar app</strong> no menu do navegador.</p>';
  return `
    <p>Instalado, o app abre em tela própria e funciona <strong>sem internet</strong> depois da primeira visita.</p>
    <div class="perfil-instalar">${instalar}</div>
    ${telaCheiaSuportada() && !estaInstalado() ? `
      <div class="btn-grupo"><button class="btn btn-secundario" id="btn-tela-cheia">⛶ Tela cheia</button></div>
      <label class="pref-chave"><span><strong>Tela cheia automática</strong><small>Entra em tela cheia no primeiro toque</small></span><input type="checkbox" id="pref-tela-cheia" role="switch" ${telaCheiaAutomatica() ? 'checked' : ''}></label>` : ''}`;
}

function opcao(nome, valor, atual, rotulo) {
  return `<label class="seg-opcao"><input type="radio" name="${nome}" value="${valor}" ${valor === atual ? 'checked' : ''}><span>${rotulo}</span></label>`;
}

export function renderPerfil(ctx) {
  const dados = ctx.dados();
  const a = dados.aluno;
  const { nivel: n, noNivel } = nivel(dados.xp || 0);
  const temChave = chaveConfigurada();
  const ganhos = new Set((dados.badges || []).map(b => b.id));
  const todos = listarTodosBadges();
  const badgesHtml = todos.map(b => `
    <li class="badge-single ${ganhos.has(b.id) ? 'ganho' : 'nao-ganho'}">
      <span class="badge-emoji" aria-hidden="true">${b.emoji}</span>
      <span class="badge-nome">${esc(b.nome)}</span>
      <span class="badge-desc">${esc(b.desc)}</span>
      <span class="sr-only">${ganhos.has(b.id) ? '(conquistada)' : '(ainda não conquistada)'}</span>
    </li>`).join('');

  document.querySelector('#conteudo').innerHTML = `
    ${cabecalho({ rotulo: 'Perfil', titulo: 'Meu perfil' })}

    <section class="perfil-hero">
      <button type="button" class="perfil-avatar" id="btn-avatar" aria-label="Trocar avatar">${esc(a.avatar || '🙂')}</button>
      <div class="perfil-id">
        <strong>${esc(a.primeiroNome)} ${esc(a.ultimoNome)}</strong>
        <span>${a.turma ? `Turma ${esc(a.turma)} · ` : ''}Nível ${n} · ${dados.xp || 0} XP</span>
        <div class="home-nivel-barra" role="progressbar" aria-label="Progresso até o próximo nível" aria-valuemin="0" aria-valuemax="${XP_POR_NIVEL}" aria-valuenow="${noNivel}"><div style="width:${noNivel}%"></div></div>
      </div>
      <div class="perfil-avatares" id="avatares" hidden>
        ${AVATARES.map(e => `<button type="button" class="avatar-op${e === a.avatar ? ' ativo' : ''}" data-avatar="${e}" aria-label="Avatar ${e}">${e}</button>`).join('')}
      </div>
    </section>

    <a href="#fontes" class="perfil-link-fontes">📚 Fontes de referência</a>
    <a href="#desempenho" class="home-atalho atalho-trilhas perfil-desempenho">${ICONES.desempenho}<strong>Meu desempenho</strong><span>${totalConcluidas(dados)} de ${TRILHAS.length} trilhas · evolução nos quizzes e conceitos para revisar</span></a>

    <div class="perfil-grade">
      <section class="card">
        <h3>Preferências</h3>
        <fieldset class="pref">
          <legend>Tamanho do texto</legend>
          <div class="seg">${opcao('fonte', 'n', fonteAtual(), 'A')}${opcao('fonte', 'g', fonteAtual(), 'A+')}${opcao('fonte', 'gg', fonteAtual(), 'A++')}</div>
        </fieldset>
        <fieldset class="pref">
          <legend>Tema</legend>
          <div class="seg">${opcao('tema', 'escuro', temaAtual(), 'Escuro')}${opcao('tema', 'claro', temaAtual(), 'Claro')}</div>
        </fieldset>
        <label class="pref-chave"><span><strong>Sons</strong><small>Efeitos curtos ao acertar e concluir</small></span><input type="checkbox" id="pref-som" role="switch" ${prefs.som ? 'checked' : ''}></label>
        <label class="pref-chave"><span><strong>Vibração</strong><small>No celular, ao responder</small></span><input type="checkbox" id="pref-vibra" role="switch" ${prefs.vibracao ? 'checked' : ''}></label>
      </section>

      <section class="card">
        <h3>Aplicativo</h3>
        <div id="area-app">${htmlAplicativo()}</div>
      </section>

      <section class="card">
        <h3>Minhas conquistas <small class="perfil-cont">${ganhos.size}/${todos.length}</small></h3>
        <ul class="badges-grid">${badgesHtml}</ul>
      </section>

      <section class="card">
        <h3>Enviar para o professor</h3>
        <p>Gera um arquivo cifrado que <strong>só o professor consegue abrir</strong>. Envie pelo canal combinado.</p>
        ${temChave
          ? `<p class="perfil-fp">Código da chave: <code id="fp-chave">…</code></p>
             <div class="btn-grupo"><button class="btn" id="btn-enviar-prof">📤 Gerar arquivo</button></div>`
          : '<div class="feedback info">O professor ainda não configurou a chave de envio.</div>'}
      </section>

      <section class="card">
        <h3>Backup e privacidade</h3>
        <p>Fica <strong>apenas neste navegador</strong>: nome, turma, progresso, respostas e diário. Nada vai a servidores — o professor só recebe o arquivo que você gerar.</p>
        <div class="btn-grupo">
          <button class="btn btn-secundario" id="btn-exportar">⬇ Baixar backup</button>
          <button class="btn btn-secundario" id="btn-importar">⬆ Importar backup</button>
          <button class="btn btn-perigo" id="btn-apagar">Apagar tudo</button>
        </div>
        <input type="file" id="input-importar" accept=".json,application/json" hidden>
      </section>
    </div>
  `;

  const $ = s => document.querySelector(s);

  /* Avatar */
  $('#btn-avatar').addEventListener('click', () => {
    const g = $('#avatares');
    g.hidden = !g.hidden;
    if (!g.hidden) g.querySelector('button')?.focus();
  });
  document.querySelectorAll('[data-avatar]').forEach(b => b.addEventListener('click', () => {
    ctx.dados().aluno.avatar = b.dataset.avatar;
    ctx.salvar();
    renderPerfil(ctx);
  }));

  /* Preferências */
  document.querySelectorAll('input[name="fonte"]').forEach(r => r.addEventListener('change', () => aplicarFonte(r.value, true)));
  document.querySelectorAll('input[name="tema"]').forEach(r => r.addEventListener('change', () => aplicarTema(r.value, true)));
  $('#pref-som').addEventListener('change', e => { prefs.som = e.target.checked; });
  $('#pref-vibra').addEventListener('change', e => { prefs.vibracao = e.target.checked; });

  /* Aplicativo */
  function ligarAplicativo() {
    $('#btn-instalar')?.addEventListener('click', async () => {
      if (await instalar()) avisar('App instalado! Procure o ícone na tela inicial.', 'ok');
    });
    $('#btn-tela-cheia')?.addEventListener('click', alternarTelaCheia);
    $('#pref-tela-cheia')?.addEventListener('change', e => definirTelaCheiaAutomatica(e.target.checked));
  }
  ligarAplicativo();
  const pararDeOuvir = aoMudarInstalacao(() => {
    const area = $('#area-app');
    if (!area) { pararDeOuvir(); return; }
    area.innerHTML = htmlAplicativo();
    ligarAplicativo();
  });

  /* Envio ao professor */
  const fp = $('#fp-chave');
  if (fp) fingerprintChave().then(v => { fp.textContent = v; }).catch(() => { fp.textContent = '—'; });
  const btnEnviar = $('#btn-enviar-prof');
  if (btnEnviar) {
    btnEnviar.addEventListener('click', async () => {
      btnEnviar.disabled = true;
      btnEnviar.textContent = 'Gerando…';
      try {
        await exportarParaProfessor(ctx.dados());
        avisar('Arquivo gerado. Envie para o professor pelo canal combinado.', 'ok');
      } catch (e) {
        avisar('Não foi possível gerar o arquivo: ' + e.message, 'erro', 6000);
      } finally {
        btnEnviar.disabled = false;
        btnEnviar.textContent = '📤 Gerar arquivo';
      }
    });
  }

  /* Backup */
  $('#btn-exportar').addEventListener('click', () => {
    if (storage.exportar()) avisar('Backup baixado.', 'ok');
    else avisar('Não foi possível gerar o backup.', 'erro');
  });
  $('#btn-importar').addEventListener('click', () => $('#input-importar').click());
  $('#input-importar').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { avisar('Arquivo grande demais para ser um backup.', 'erro'); return; }
    const ok = await confirmar({
      titulo: 'Importar este backup?',
      texto: 'O progresso atual deste aparelho será substituído pelo do arquivo. A importação fica registrada no relatório do professor.',
      ok: 'Importar', perigo: true
    });
    if (!ok) return;
    let texto;
    try { texto = await file.text(); } catch (_) { avisar('Não foi possível ler o arquivo.', 'erro'); return; }
    const novo = storage.importar(texto, ctx.dados()?.nonceDispositivo);
    if (novo) { ctx.substituirDados(novo); avisar('Backup importado.', 'ok'); ctx.navegar('perfil'); }
    else avisar('Este arquivo não é um backup válido do Ondulatória.', 'erro', 6000);
  });
  $('#btn-apagar').addEventListener('click', async () => {
    const ok = await confirmar({
      titulo: 'Apagar todo o progresso?',
      texto: 'Nome, trilhas, XP, conquistas, flashcards e diário serão apagados deste aparelho. Não dá para desfazer. Se quiser, baixe um backup antes.',
      ok: 'Apagar tudo', perigo: true, icone: '⚠️'
    });
    if (!ok) return;
    storage.apagar();
    ctx.substituirDados(storage.inicializar());
    avisar('Dados apagados.', 'ok');
    ctx.navegar('inicio');
  });
}
