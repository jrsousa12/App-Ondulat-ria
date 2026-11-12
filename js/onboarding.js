/* Cadastro inicial em 3 passos: boas-vindas, nome/turma e avatar. */
import { esc } from './utils.js';
import { AVATARES } from './conteudo.js';
import { avisar } from './dialogos.js';
import { ICONES } from './ui.js';

export function renderOnboarding(ctx) {
  const conteudo = document.querySelector('#conteudo');
  const rascunho = { primeiroNome: '', ultimoNome: '', turma: '', avatar: AVATARES[0] };
  let passo = 0;

  function pontos() {
    return `<ol class="onb-pontos" aria-label="Passo ${passo + 1} de 3">${[0, 1, 2].map(i => `<li class="${i <= passo ? 'ativo' : ''}"></li>`).join('')}</ol>`;
  }

  function render() {
    if (passo === 0) {
      conteudo.innerHTML = `
        <section class="onboarding onb-boasvindas">
          ${pontos()}
          <svg class="onb-onda" viewBox="0 0 200 60" aria-hidden="true"><path d="M0,30 Q25,0 50,30 T100,30 T150,30 T200,30"/></svg>
          <h2>Bem-vindo(a) à Ondulatória</h2>
          <p class="onb-sub">Um app para aprender ondas e som jogando.</p>
          <ul class="onb-lista">
            <li>${ICONES.trilhas}<span><strong>6 trilhas</strong> com leitura, perguntas e quiz</span></li>
            <li>${ICONES.praticar}<span><strong>Praticar</strong> com flashcards, diário sonoro e atividades</span></li>
            <li>${ICONES.lab}<span><strong>Laboratório</strong> para ver e ouvir ondas</span></li>
            <li>${ICONES.desempenho}<span><strong>XP, níveis e conquistas</strong> a cada passo</span></li>
          </ul>
          <button class="btn btn-grande" id="onb-avancar">Vamos começar</button>
        </section>`;
      document.getElementById('onb-avancar').addEventListener('click', () => { passo = 1; render(); });
      return;
    }

    if (passo === 1) {
      conteudo.innerHTML = `
        <section class="onboarding">
          ${pontos()}
          <h2>Como você se chama?</h2>
          <p class="onb-sub">O nome aparece no app e no arquivo que você enviar ao professor.</p>
          <form id="form-onboarding" novalidate>
            <label for="in-nome">Primeiro nome *</label>
            <input id="in-nome" type="text" required maxlength="30" autocomplete="given-name" value="${esc(rascunho.primeiroNome)}">
            <label for="in-sobrenome">Último nome *</label>
            <input id="in-sobrenome" type="text" required maxlength="30" autocomplete="family-name" value="${esc(rascunho.ultimoNome)}">
            <label for="in-turma">Turma</label>
            <input id="in-turma" type="text" maxlength="10" placeholder="ex: 9A" autocomplete="off" value="${esc(rascunho.turma)}">
            <div class="btn-grupo onb-acoes">
              <button type="button" class="btn btn-secundario" id="onb-voltar">Voltar</button>
              <button type="submit" class="btn">Continuar</button>
            </div>
          </form>
        </section>`;
      document.getElementById('in-nome').focus();
      document.getElementById('onb-voltar').addEventListener('click', () => { passo = 0; render(); });
      document.getElementById('form-onboarding').addEventListener('submit', e => {
        e.preventDefault();
        const p = document.getElementById('in-nome').value.trim();
        const u = document.getElementById('in-sobrenome').value.trim();
        if (!p || !u) {
          avisar('Preencha o primeiro e o último nome.', 'erro');
          document.getElementById(!p ? 'in-nome' : 'in-sobrenome').focus();
          return;
        }
        Object.assign(rascunho, { primeiroNome: p, ultimoNome: u, turma: document.getElementById('in-turma').value.trim() });
        passo = 2;
        render();
      });
      return;
    }

    conteudo.innerHTML = `
      <section class="onboarding">
        ${pontos()}
        <h2>Escolha seu avatar</h2>
        <p class="onb-sub">Você pode trocar depois, no Perfil.</p>
        <div class="onb-avatares" role="radiogroup" aria-label="Avatar">
          ${AVATARES.map(a => `<button type="button" role="radio" class="avatar-op${a === rascunho.avatar ? ' ativo' : ''}" aria-checked="${a === rascunho.avatar}" data-avatar="${a}" aria-label="Avatar ${a}">${a}</button>`).join('')}
        </div>
        <div class="aviso-privacidade">
          <strong>Privacidade:</strong> nome, turma e progresso ficam <em>somente neste aparelho</em>.
          Nada é enviado a servidores — o professor só recebe o arquivo que você gerar no Perfil.
        </div>
        <div class="btn-grupo onb-acoes">
          <button type="button" class="btn btn-secundario" id="onb-voltar">Voltar</button>
          <button type="button" class="btn" id="onb-fim">Começar a aprender</button>
        </div>
      </section>`;
    conteudo.querySelectorAll('[data-avatar]').forEach(b => b.addEventListener('click', () => {
      rascunho.avatar = b.dataset.avatar;
      conteudo.querySelectorAll('[data-avatar]').forEach(x => {
        x.classList.toggle('ativo', x === b);
        x.setAttribute('aria-checked', String(x === b));
      });
    }));
    document.getElementById('onb-voltar').addEventListener('click', () => { passo = 1; render(); });
    document.getElementById('onb-fim').addEventListener('click', () => {
      Object.assign(ctx.dados().aluno, rascunho);
      ctx.salvar();
      ctx.navegar('inicio');
    });
  }

  render();
}
