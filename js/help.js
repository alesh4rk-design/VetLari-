// Tutoriais curtos por aba: o link "Como usar esta aba" abre uma janela com o passo a passo da tela atual.
import { esc } from './utils.js';
import { openModal } from './ui.js';

const TUTORIALS = {
  inicio: { title: 'Início', intro: 'Painel com atalhos e os seus exames mais recentes.', steps: [
    'Use os botões grandes para começar um <strong>Novo laudo</strong>, cadastrar um paciente ou abrir frases, modelos e laudos.',
    'Digite um nome na busca para encontrar laudos rapidamente.',
    'Os números mostram quantos exames estão em rascunho/preliminar e quantos já foram finalizados.',
    'Se aparecer um aviso amarelo, são rascunhos parados há mais de 3 dias: clique para continuar de onde parou.',
    'Em "Exames recentes", clique no exame para abrir e editar.'] },
  novo: { title: 'Novo laudo', intro: 'Escolha o tipo de exame e comece. Tudo pode ser ajustado depois.', steps: [
    'Escolha a <strong>modalidade</strong> (ultrassonografia ou radiografia).',
    'Escolha o <strong>modelo</strong>: ele define quais órgãos/estruturas aparecem. Você pode criar os seus em "Modelos".',
    'Se o paciente já estiver cadastrado, selecione-o para preencher os dados sozinhos. Se não, deixe em branco e preencha no laudo.',
    'Clique em <strong>Começar laudo</strong>. O laudo é salvo automaticamente neste aparelho.'] },
  'laudo-0': { title: 'Etapa 1 · Paciente', intro: 'Dados do animal e do exame. Só o nome do animal é obrigatório.', steps: [
    'Em "Paciente cadastrado", escolha um animal já salvo para preencher tudo de uma vez.',
    'Em <strong>Espécie</strong> e <strong>Raça</strong>, escolha na lista (botão Lista) ou digite livremente.',
    'Informe a <strong>data de nascimento</strong>: a idade é calculada sozinha. Sem ela, digite a idade.',
    'O <strong>peso</strong> pode ser em kg ou em gramas (a unidade muda para gramas em aves, roedores, coelhos, furões, répteis e silvestres, mas você pode trocar).',
    '<strong>Data e hora do exame</strong> são opcionais e começam vazias. Se ficarem em branco, não aparecem no laudo.',
    'Em "Exame", preencha indicação, pergunta clínica, histórico, medicamentos etc. Campos vazios são omitidos do laudo.',
    'Abaixo de cada campo de texto há <strong>Inserir</strong> (frase salva), <strong>Ditar</strong> (voz) e <strong>Guardar</strong> (salvar o que escreveu como frase para os próximos laudos).',
    'Deixe marcado "Salvar/atualizar no cadastro" para guardar o paciente ao finalizar.'] },
  'laudo-1': { title: 'Etapa 2 · Achados', intro: 'Aqui o texto do laudo se monta a partir do que você seleciona.', steps: [
    'Escolha o órgão na <strong>lista</strong> ao lado (ou acima, no celular).',
    'Marque o <strong>status</strong> do órgão. Nada é presumido como normal: órgão sem status e sem texto não aparece no laudo.',
    'Toque nas opções (chips) de cada característica; a frase é escrita sozinha na redação do catálogo.',
    'Preencha as <strong>medidas</strong> (valor e unidade) onde pedir: elas entram automaticamente na frase.',
    'O campo de descrição pode ser editado à mão. Use <strong>Inserir</strong>, <strong>Ditar</strong> e <strong>Guardar</strong> para frases suas.',
    'Use <strong>**negrito**</strong> e <strong>__itálico__</strong> no texto se quiser destacar algo.',
    'Use <strong>Imagens ao lado do texto</strong> para ver as imagens do exame junto com os achados: clique numa imagem para ampliar e anotar, ou use <strong>Adicionar</strong> para importar mais.',
    'Para consultar referências ou usar cálculos cadastrados, veja a aba "Bases".'] },
  'laudo-2': { title: 'Etapa 3 · Imagens', intro: 'As imagens ficam salvas só neste aparelho.', steps: [
    'Adicione imagens pela galeria ou câmera. Elas são comprimidas conforme as Configurações.',
    'Escreva uma <strong>legenda</strong> e escolha a região de cada imagem, se quiser. Dá para girar e reordenar.',
    'Abra uma imagem para ampliar e fazer anotações (seta, círculo e texto).',
    'No laudo final, as imagens saem em grade, na quantidade por linha definida no modelo.'] },
  'laudo-3': { title: 'Etapa 4 · Conclusão', intro: 'Impressão diagnóstica e observações, sempre escritas por você.', steps: [
    'Em <strong>Impressão diagnóstica</strong>, escreva um item por linha ou use <strong>Inserir</strong> para frases salvas.',
    'Preencha "Diagnósticos diferenciais" e "Observações e recomendações" só se houver.',
    'Use <strong>Guardar</strong> para salvar uma frase e reutilizá-la depois.',
    'A conclusão é sempre uma decisão médica sua: o sistema não conclui nada sozinho.'] },
  'laudo-4': { title: 'Etapa 5 · Prévia e exportar', intro: 'Revise e gere o documento final.', steps: [
    'Leia os <strong>alertas</strong>: os críticos pedem correção ou justificativa para finalizar; os informativos são avisos.',
    'Confira a <strong>prévia</strong> abaixo: o Word e o PDF saem exatamente iguais a ela.',
    'Escolha <strong>Baixar Word</strong> ou <strong>Baixar PDF</strong>.',
    'Use <strong>Enviar PDF pelo WhatsApp</strong>: no celular abre o WhatsApp já com o PDF anexado; no computador o PDF é baixado e o WhatsApp abre para você anexar.',
    'Use "Marcar como preliminar" enquanto estiver em andamento e <strong>Finalizar laudo</strong> quando estiver pronto (somente perfil de veterinário).',
    'Depois de finalizado, o laudo fica protegido. Para mudar algo, use <strong>Retificar</strong> ou <strong>Adicionar adendo</strong>: cria uma nova versão e mantém o histórico.'] },
  laudos: { title: 'Meus laudos', intro: 'Lista de todos os exames deste aparelho.', steps: [
    'Use a busca e os filtros para achar um exame.',
    'Clique em um exame para abrir e continuar editando (se não estiver finalizado).',
    'Para <strong>comparar</strong> dois laudos do mesmo paciente, abra um deles e use "Outros exames deste paciente" na parte de cima.',
    'A exclusão exige confirmação; laudos finalizados só podem ser excluídos por perfis autorizados.'] },
  comparar: { title: 'Comparar laudos', intro: 'Mostra lado a lado as medidas e os textos de dois laudos.', steps: [
    'As diferenças de medidas aparecem por estrutura.',
    'O sistema <strong>não conclui</strong> se algo cresceu, diminuiu ou piorou: a interpretação é sua.'] },
  pacientes: { title: 'Pacientes', intro: 'Cadastro dos animais atendidos.', steps: [
    'Clique em <strong>Novo paciente</strong> para cadastrar. Só o nome é obrigatório.',
    'Use a busca para encontrar um paciente e clique para editar.',
    'No <strong>Novo laudo</strong>, escolha o paciente para preencher os dados automaticamente.'] },
  paciente: { title: 'Cadastro do paciente', intro: 'Dados do animal e do tutor.', steps: [
    'Escolha <strong>espécie</strong> e <strong>raça</strong> na lista ou digite livremente.',
    'Com a <strong>data de nascimento</strong> a idade é calculada sozinha.',
    'O peso pode ser em kg ou gramas.',
    'Clique em <strong>Salvar paciente</strong>. Os dados ficam só neste aparelho.'] },
  frases: { title: 'Biblioteca de frases', intro: 'Suas frases prontas, para inserir nos laudos com um toque.', steps: [
    'Clique em <strong>Nova frase</strong>. Dê um nome curto, escolha a <strong>estrutura anatômica</strong> na lista e escreva o texto.',
    'Use <code>{Nome}</code> no texto para um valor que muda (ex.: <code>medindo {Comprimento}</code>): ele é preenchido pela medida de mesmo nome.',
    'Marque como <strong>favorita</strong> para aparecer primeiro.',
    'Frases também são criadas pelo botão <strong>Guardar</strong> dentro do laudo e ficam ligadas ao órgão/campo onde foram escritas.',
    'Use Exportar/Importar JSON para fazer cópia ou levar frases para outro aparelho.'] },
  modelos: { title: 'Meus modelos', intro: 'Modelos definem quais órgãos aparecem em cada tipo de laudo.', steps: [
    'Os modelos iniciais são só um ponto de partida: use <strong>Duplicar e editar</strong> para criar o seu.',
    'Adicione, remova e reordene estruturas, e defina medidas e o sexo (macho/fêmea) quando fizer sentido.',
    'Salve o modelo e escolha-o ao iniciar um <strong>Novo laudo</strong>.'] },
  modelo: { title: 'Editar modelo', intro: 'Monte a estrutura do laudo.', steps: [
    'Dê um nome ao modelo e ajuste o título, a conclusão e as imagens por linha.',
    'Em cada estrutura, use <strong>Adicionar medida</strong> e, se quiser, <strong>Criar frases para este órgão</strong>.',
    'Clique em <strong>Salvar modelo</strong>.'] },
  referencias: { title: 'Bases técnicas · Referências', intro: 'Valores de referência cadastrados por você. O sistema não traz valores prontos.', steps: [
    'Clique em <strong>Nova referência</strong> e informe espécie, estrutura, medida, valores e a fonte.',
    'Salve como <strong>rascunho</strong> e use <strong>Aprovar para uso</strong> quando tiver certeza: só referências aprovadas aparecem no laudo.',
    'Use Exportar/Importar JSON para cópia de segurança.'] },
  calculos: { title: 'Bases técnicas · Cálculos', intro: 'Fórmulas cadastradas por você para calcular medidas.', steps: [
    'Clique em <strong>Novo cálculo</strong>, escreva a fórmula e use <strong>Detectar variáveis</strong>.',
    'Teste com <strong>Calcular</strong> e salve.',
    'No laudo, o resultado entra como <strong>medida calculada</strong>.',
    'O sistema não cria nem sugere fórmulas: use as da sua fonte confiável.'] },
  config: { title: 'Configurações', intro: 'Dados do profissional e aparência do documento.', steps: [
    'Preencha nome, CRMV, serviço e contato: saem no cabeçalho/rodapé do laudo.',
    'Envie os dois <strong>logotipos</strong> (serviço à esquerda, clínica à direita).',
    'Em <strong>Assinatura</strong>, desenhe com o dedo/mouse ou envie a imagem da sua assinatura: ela sai nos laudos finalizados.',
    'Ajuste fonte, tamanho e o texto fixo após a conclusão.',
    'Em <strong>Backup</strong>, exporte uma cópia regularmente: limpar os dados do navegador apaga tudo.',
    'Se uma novidade não aparecer, use a página de atualização (link em "Sobre").'] },
};

/** Chave do tutorial a partir do caminho da rota. */
export function helpKeyForPath(path) {
  const p = path.replace(/\/$/, '') || '/';
  if (p === '/') return 'inicio';
  if (/^\/laudo\/[^/]+$/.test(p)) return 'laudo-0';
  if (p.startsWith('/comparar/')) return 'comparar';
  if (p.startsWith('/paciente/')) return 'paciente';
  if (p.startsWith('/modelo/')) return 'modelo';
  return p.slice(1) in TUTORIALS ? p.slice(1) : '';
}

export function openHelp(key) {
  const t = TUTORIALS[key];
  if (!t) return;
  const m = openModal(`<h2>Como usar: ${esc(t.title)}</h2><p class="muted">${t.intro}</p>
    <ol class="helplist">${t.steps.map((s) => `<li>${s}</li>`).join('')}</ol>
    <div class="row end" style="margin-top:12px"><button class="btn primary" data-x="close">Entendi</button></div>`, { label: `Como usar: ${t.title}` });
  m.el.querySelector('[data-x=close]').onclick = () => m.close(null);
}

/** Coloca (ou troca) o link de ajuda logo abaixo do cabeçalho da tela. */
export function attachHelp(view, key) {
  view.querySelector('.helpbar')?.remove();
  if (!TUTORIALS[key]) return;
  const bar = document.createElement('div');
  bar.className = 'helpbar no-print';
  bar.innerHTML = '<button type="button" class="help-link">❓ Como usar esta aba</button>';
  bar.firstChild.onclick = () => openHelp(key);
  const head = view.querySelector('.page-head');
  if (head) head.after(bar); else view.prepend(bar);
}
