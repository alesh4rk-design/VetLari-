// Espécies e raças sugeridas. São apenas sugestões: o campo sempre aceita texto livre.
import { norm } from './utils.js';

/** Pesos de animais pequenos são mais naturais em gramas; é só o padrão sugerido, a unidade sempre pode ser trocada. */
const GRAM_SPECIES = ['ave', 'roedor', 'coelho', 'furao', 'reptil', 'silvestre'];
export const defaultWeightUnit = (species) => (GRAM_SPECIES.includes(speciesKey(species)) ? 'g' : 'kg');

export const SPECIES = ['Cão', 'Gato', 'Ave', 'Roedor', 'Coelho', 'Furão', 'Réptil', 'Equino', 'Bovino', 'Suíno', 'Ovino/Caprino', 'Silvestre'];

/** Chave canônica da espécie, para tratar "Cão", "Canino" e "cachorro" como a mesma espécie. */
const SYNONYMS = {
  cao: ['cao', 'caes', 'cachorro', 'cachorra', 'canino', 'canina', 'canis'],
  gato: ['gato', 'gata', 'felino', 'felina', 'felis'],
  ave: ['ave', 'aves', 'passaro', 'passarinho', 'ave silvestre'],
  roedor: ['roedor', 'roedores', 'hamster', 'cobaia', 'porquinho-da-india', 'chinchila', 'gerbil', 'rato', 'camundongo'],
  coelho: ['coelho', 'lagomorfo', 'lebre'],
  furao: ['furao', 'furoes'],
  reptil: ['reptil', 'repteis', 'tartaruga', 'jabuti', 'iguana', 'cobra', 'lagarto'],
  equino: ['equino', 'cavalo', 'egua', 'equinos'],
  bovino: ['bovino', 'boi', 'vaca', 'bovinos'],
  suino: ['suino', 'porco', 'suinos'],
};
export function speciesKey(species) {
  const n = norm(species);
  if (!n) return '';
  for (const [key, list] of Object.entries(SYNONYMS)) if (list.includes(n)) return key;
  return n;
}

export const BREEDS = {
  cao: ['SRD (sem raça definida)', 'Shih Tzu', 'Yorkshire Terrier', 'Spitz Alemão (Lulu da Pomerânia)', 'Poodle', 'Golden Retriever', 'Labrador Retriever', 'Pug',
    'Bulldog Francês', 'Bulldog Inglês', 'Chihuahua', 'Pinscher', 'Maltês', 'Lhasa Apso', 'Dachshund (Salsicha)', 'Pastor Alemão', 'Rottweiler', 'Border Collie',
    'Husky Siberiano', 'Beagle', 'Boxer', 'Cocker Spaniel', 'Pit Bull', 'American Bully', 'American Staffordshire Terrier', 'Schnauzer', 'Akita', 'Basset Hound',
    'Doberman', 'Fila Brasileiro', 'Shar-pei', 'Dálmata', 'Jack Russell Terrier', 'West Highland White Terrier', 'Pastor Belga', 'Samoieda', 'Chow Chow',
    'Cavalier King Charles Spaniel', 'Boston Terrier', 'Weimaraner', 'São Bernardo', 'Dogue Alemão', 'Pastor de Shetland', 'Bichon Frisé', 'Lulu da Pomerânia'],
  gato: ['SRD (sem raça definida)', 'Persa', 'Siamês', 'Maine Coon', 'Ragdoll', 'Angorá', 'Bengal', 'British Shorthair', 'Sphynx', 'Himalaio', 'Abissínio',
    'Scottish Fold', 'Birmanês', 'Exótico', 'Norueguês da Floresta', 'Azul Russo'],
  ave: ['Calopsita', 'Periquito-australiano', 'Papagaio-verdadeiro', 'Agapornis', 'Canário', 'Cacatua', 'Arara', 'Maritaca', 'Periquito-de-colar', 'Galinha', 'Pato', 'Codorna', 'Pombo'],
  roedor: ['Hamster sírio', 'Hamster anão russo', 'Porquinho-da-índia (cobaia)', 'Chinchila', 'Gerbil', 'Rato Twister', 'Camundongo', 'Esquilo-da-mongólia'],
  coelho: ['Mini Lop', 'Anão (Mini coelho)', 'Holandês', 'Rex', 'Angorá', 'Lionhead', 'Fuzzy Lop', 'Nova Zelândia'],
  furao: ['Furão doméstico'],
  reptil: ['Tartaruga-tigre-d\'água', 'Jabuti-piranga', 'Jabuti-tinga', 'Iguana-verde', 'Gecko-leopardo', 'Dragão-barbudo', 'Cobra-do-milho', 'Píton-bola'],
  equino: ['Quarto de Milha', 'Mangalarga Marchador', 'Crioulo', 'Árabe', 'Puro-sangue Inglês', 'Campolina', 'Pônei'],
  bovino: ['Nelore', 'Holandês', 'Gir', 'Girolando', 'Angus', 'Jersey', 'Brahman'],
  suino: ['Landrace', 'Large White', 'Duroc', 'Pietrain', 'Mini pig'],
};
export const breedsFor = (species) => BREEDS[speciesKey(species)] || [];

export const optionsHtml = (list) => list.map((x) => `<option value="${String(x).replace(/"/g, '&quot;')}">`).join('');
