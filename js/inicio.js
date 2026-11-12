/* Tela inicial. */
import { esc, hojeLocal } from './utils.js';
import { TRILHAS } from './conteudo.js';
import { listarTodosBadges } from './badges.js';
import { ICONES, iconeTrilha, etapas } from './ui.js';
import { XP_POR_NIVEL, nivel, trilhaConcluida, trilhaLiberada, etapasTrilha, proximaTrilha, totalConcluidas } from './progresso.js';

function saudacao() {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

function anelProgresso(concluidas) {
  const pct = Math.round((concluidas / TRILHAS.length) * 100);
  const C = 2 * Math.PI * 52;
  return `
    <svg class="home-anel" viewBox="0 0 120 120" role="img" aria-label="${pct}% das trilhas concluídas">
      <defs>
        <linearGradient id="grad-anel" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#67E8F9"/><stop offset="1" stop-color="#34D399"/>
        </linearGradient>
      </defs>
      <circle class="home-anel-fundo" cx="60" cy="60" r="52"/>
      <circle class="home-anel-valor" cx="60" cy="60" r="52" stroke="url(#grad-anel)"
        stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${(C * (1 - pct / 100)).toFixed(1)}"/>
      <text x="60" y="58" class="home-anel-num">${concluidas}/${TRILHAS.length}</text>
      <text x="60" y="78" class="home-anel-rot">trilhas</text>
    </svg>`;
}

function cartaoContinuar(dados) {
  const prox = proximaTrilha(dados);
  if (!prox) {
    return `
      <div class="home-continuar home-continuar-fim">
        <span class="home-rotulo">Parabéns!</span>
        <strong class="home-continuar-titulo">Você concluiu todas as trilhas 🏆</strong>
        <span class="home-continuar-desc">Continue treinando no Praticar e explore o Laboratório.</span>
        <a href="#praticar" class="home-continuar-btn">Praticar ${ICONES.seta}</a>
      </div>`;
  }
  const feitas = etapasTrilha(dados, prox.id);
  return `
    <a href="#trilha/${prox.id}" class="home-continuar" data-trilha="${prox.id}">
      <span class="home-continuar-icone">${iconeTrilha(prox.id)}</span>
      <span class="home-rotulo">${feitas ? 'Continue de onde parou' : 'Próxima trilha'}</span>
      <span class="home-continuar-num">Trilha ${prox.id}</span>
      <strong class="home-continuar-titulo">${esc(prox.titulo)}</strong>
      <span class="home-continuar-desc">${esc(prox.desc)}</span>
      ${etapas(Math.min(feitas, 2), feitas === 1 ? 0 : feitas)}
      <span class="home-continuar-btn">${feitas ? 'Continuar' : 'Começar'} ${ICONES.seta}</span>
    </a>`;
}

function mapaJornada(dados) {
  const prox = proximaTrilha(dados);
  return TRILHAS.map(t => {
    const ok = trilhaConcluida(dados, t.id);
    const livre = trilhaLiberada(dados, t.id);
    const atual = prox && prox.id === t.id;
    const cls = ok ? 'feita' : (atual ? 'atual' : (livre ? 'livre' : 'bloqueada'));
    const icone = ok ? ICONES.check : (livre ? t.id : ICONES.cadeado);
    const estado = ok ? 'concluída' : (livre ? 'disponível' : 'bloqueada');
    const miolo = `<span class="home-no">${icone}</span><span class="home-no-nome">${esc(t.curto)}</span>`;
    const rotulo = `Trilha ${t.id}: ${esc(t.titulo)} (${estado})`;
    return livre
      ? `<li><a href="#trilha/${t.id}" class="home-mapa-item ${cls}" data-trilha="${t.id}" aria-label="${rotulo}">${miolo}</a></li>`
      : `<li><span class="home-mapa-item ${cls}" role="img" aria-label="${rotulo}">${miolo}</span></li>`;
  }).join('');
}

/** Cartão "Treino de hoje": caderno de erros e flashcards a revisar. */
export function cartaoEstudo(dados) {
  const caderno = Object.keys(dados.cadernoErros || {}).length;
  const dia = hojeLocal();
  const flash = Object.values(dados.flashcards || {}).filter(c => c.proximaRevisao && c.proximaRevisao <= dia).length;
  return `
    <section class="home-estudo" aria-labelledby="home-estudo-tit">
      <h3 id="home-estudo-tit">${ICONES.treino}Treino de hoje</h3>
      <ul>
        <li><a href="#praticar/treino"><strong>${caderno}</strong><span>no caderno de erros</span></a></li>
        <li><a href="#praticar/flash"><strong>${flash}</strong><span>flashcards para revisar</span></a></li>
      </ul>
      <a href="#praticar/treino" class="btn btn-grande">Treinar agora</a>
    </section>`;
}

export function renderInicio(ctx, extras = {}) {
  const dados = ctx.dados();
  const a = dados.aluno;
  const xp = dados.xp || 0;
  const { nivel: n, noNivel } = nivel(xp);
  const concluidas = totalConcluidas(dados);
  const badges = dados.badges || [];
  const totalBadges = listarTodosBadges().length;
  const flash = Object.keys(dados.flashcards || {}).length;
  const turma = a.turma ? `<span class="home-chip">Turma ${esc(a.turma)}</span>` : '';

  const recentes = badges.slice(-3).reverse();
  const conquistas = recentes.length
    ? recentes.map(b => `<li class="home-badge"><span class="home-badge-emoji" aria-hidden="true">${esc(b.emoji)}</span>${esc(b.nome)}</li>`).join('')
    : '<li class="home-badge home-badge-vazio">Conclua atividades para ganhar sua primeira conquista.</li>';

  document.querySelector('#conteudo').innerHTML = `
    <div class="home-grade">
      <div class="home-col">
        <section class="home-hero" aria-labelledby="home-ola">
          <svg class="home-hero-ondas" viewBox="0 0 600 200" preserveAspectRatio="none" aria-hidden="true">
            <path d="M0,120 Q75,60 150,120 T300,120 T450,120 T600,120 V200 H0Z"/>
            <path d="M0,140 Q75,95 150,140 T300,140 T450,140 T600,140 V200 H0Z"/>
          </svg>
          <div class="home-hero-texto">
            <p class="home-saudacao">${a.avatar ? `<span class="home-avatar" aria-hidden="true">${esc(a.avatar)}</span>` : ''}${saudacao()}${turma}</p>
            <h2 id="home-ola">${a.primeiroNome ? `Olá, ${esc(a.primeiroNome)}!` : 'Olá!'}</h2>
            <div class="home-nivel">
              <div class="home-nivel-topo"><strong>Nível ${n}</strong><span>${noNivel}/${XP_POR_NIVEL} XP</span></div>
              <div class="home-nivel-barra" role="progressbar" aria-label="Progresso até o próximo nível"
                   aria-valuemin="0" aria-valuemax="${XP_POR_NIVEL}" aria-valuenow="${noNivel}">
                <div style="width:${noNivel}%"></div>
              </div>
            </div>
          </div>
          ${anelProgresso(concluidas)}
        </section>

        <a href="#desempenho" class="home-stats-link" aria-label="Ver meu desempenho completo">
          <ul class="home-stats">
            <li><strong>${xp}</strong><span>XP total</span></li>
            <li><strong>${badges.length}<small>/${totalBadges}</small></strong><span>Conquistas</span></li>
            <li><strong>${flash}</strong><span>Flashcards</span></li>
          </ul>
        </a>

        ${cartaoContinuar(dados)}

        <section class="home-secao" aria-labelledby="home-mapa-tit">
          <div class="home-secao-topo">
            <h3 id="home-mapa-tit">Sua jornada</h3>
            <a href="#trilhas" class="home-link">Ver trilhas</a>
          </div>
          <ol class="home-mapa">${mapaJornada(dados)}</ol>
        </section>
      </div>

      <div class="home-col">
        ${extras.estudo || ''}
        <section class="home-secao" aria-labelledby="home-atalhos-tit">
          <h3 id="home-atalhos-tit" class="sr-only">Atalhos</h3>
          <div class="home-atalhos">
            <a href="#praticar" class="home-atalho atalho-praticar">${ICONES.praticar}<strong>Praticar</strong><span>Flashcards, diário e atividades</span></a>
            <a href="#lab" class="home-atalho atalho-lab">${ICONES.lab}<strong>Laboratório</strong><span>Simule e ouça ondas</span></a>
            <a href="#desempenho" class="home-atalho atalho-trilhas">${ICONES.desempenho}<strong>Desempenho</strong><span>Notas, evolução e conceitos</span></a>
            <a href="#perfil" class="home-atalho atalho-perfil">${ICONES.perfil}<strong>Perfil</strong><span>Conquistas e preferências</span></a>
          </div>
        </section>

        <section class="home-secao" aria-labelledby="home-conq-tit">
          <div class="home-secao-topo">
            <h3 id="home-conq-tit">Conquistas recentes</h3>
            <a href="#perfil" class="home-link">Ver todas</a>
          </div>
          <ul class="home-badges">${conquistas}</ul>
        </section>

        <p class="home-privacidade">🔒 Seu progresso fica <strong>só neste aparelho</strong>. Nada é enviado a servidores.</p>
      </div>
    </div>
  `;
}
