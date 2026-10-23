// Ditado por voz com a Web Speech API do navegador. A transcrição NUNCA entra no laudo sem revisão:
// ela aparece numa caixa editável e só é inserida (na posição do cursor, sem apagar nada) quando a
// profissional clica em "Inserir". Se o navegador não suportar voz, a caixa funciona para digitação manual.
import { esc } from './utils.js';
import { openModal } from './ui.js';

export const speechCtor = () => globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition || null;

const ERRORS = {
  'not-allowed': 'Permissão do microfone negada. Libere o microfone nas configurações do navegador.',
  'service-not-allowed': 'O reconhecimento de voz não está autorizado neste navegador.',
  'no-speech': 'Nenhuma fala detectada.',
  'audio-capture': 'Microfone não encontrado.',
  network: 'Falha de rede no serviço de reconhecimento de voz do navegador.',
  'language-not-supported': 'Português (Brasil) não é suportado por este reconhecimento de voz.',
};

/** Abre a janela de ditado. Resolve com o texto revisado ou null se cancelado. */
export function openDictation({ label = 'campo' } = {}) {
  const SR = speechCtor();
  const m = openModal(`<h2>Ditado — ${esc(label)}</h2>
    <p class="alert info small">A transcrição é feita pelo reconhecimento de voz do seu navegador/aparelho e <strong>pode enviar o áudio ao serviço do fabricante</strong>. Qualidade e disponibilidade variam. <strong>Confira nomes anatômicos, medidas, unidades, lateralidade e pontuação</strong> antes de inserir. Nada é inserido sem a sua confirmação.</p>
    ${SR ? '' : '<div class="alert warn">Este navegador não oferece reconhecimento de voz. Você pode digitar o texto aqui e inseri-lo normalmente.</div>'}
    <div class="row" style="margin-bottom:8px">
      <button class="btn primary" data-x="start" ${SR ? '' : 'disabled'}>Iniciar gravação</button>
      <button class="btn" data-x="stop" disabled>Parar</button>
      <span id="vstate" class="status" role="status">${SR ? 'Parado' : 'Voz indisponível'}</span></div>
    <div class="field"><label for="vtext">Texto (editável)</label><textarea id="vtext" rows="6" autofocus></textarea>
      <div class="small muted" id="vinterim" aria-live="polite"></div></div>
    <div class="row end"><button class="btn" data-x="cancel">Cancelar</button><button class="btn primary" data-x="ok">Inserir no campo</button></div>`, { label: 'Ditado por voz' });
  const ta = m.el.querySelector('#vtext'), interim = m.el.querySelector('#vinterim'), state = m.el.querySelector('#vstate');
  const start = m.el.querySelector('[data-x=start]'), stop = m.el.querySelector('[data-x=stop]');
  let rec = null, running = false;
  const setState = (t, cls = '') => { state.textContent = t; state.className = `status ${cls}`; };
  const halt = () => { running = false; start.disabled = !SR; stop.disabled = true; interim.textContent = ''; if (state.textContent === 'Gravando…') setState('Parado'); };

  if (SR) {
    rec = new SR();
    rec.lang = 'pt-BR'; rec.interimResults = true; rec.continuous = true;
    rec.onresult = (ev) => {
      let live = '';
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const r = ev.results[i];
        if (r.isFinal) {
          const text = r[0].transcript.trim();
          if (text) ta.value += (ta.value && !/\s$/.test(ta.value) ? ' ' : '') + text; // acrescenta, nunca substitui
        } else live += r[0].transcript;
      }
      interim.textContent = live ? `Ouvindo: ${live}` : '';
    };
    rec.onerror = (ev) => { setState(ERRORS[ev.error] || `Erro de reconhecimento (${ev.error}).`, 'error'); halt(); };
    rec.onend = () => halt();
  }
  m.el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-x]'); if (!b) return;
    const act = b.dataset.x;
    if (act === 'start' && rec && !running) {
      try { rec.start(); running = true; start.disabled = true; stop.disabled = false; setState('Gravando…', 'saving'); }
      catch { setState('Não foi possível iniciar a gravação.', 'error'); }
    } else if (act === 'stop' && rec) { rec.stop(); }
    else if (act === 'cancel') { try { rec && rec.abort(); } catch { /* ignora */ } m.close(null); }
    else if (act === 'ok') { try { rec && rec.abort(); } catch { /* ignora */ } m.close(ta.value.trim() || null); }
  });
  return m.closed;
}
