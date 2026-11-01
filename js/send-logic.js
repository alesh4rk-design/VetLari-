// Envio do laudo: número de WhatsApp e e-mail do destinatário (opcionais). Funções puras, testadas.

/** Telefone brasileiro → só dígitos com 55: "(21) 99999-8888" → "5521999998888". Inválido → ''. */
export function whatsappNumber(raw) {
  let d = String(raw || '').replace(/\D/g, '').replace(/^0+/, '');
  if (!d) return '';
  if (d.length === 10 || d.length === 11) d = '55' + d;                       // DDD + número
  if (d.startsWith('55') && (d.length === 12 || d.length === 13)) return d;   // já com o país
  return d.length >= 11 && d.length <= 15 && !d.startsWith('55') ? d : '';    // número de outro país, digitado completo
}
export const isEmail = (s) => /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]{2,}$/.test(String(s || '').trim());

export const whatsappLink = (phone, text) => {
  const n = whatsappNumber(phone);
  return `https://wa.me/${n}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
};
export const mailtoLink = (to, subject, body) => `mailto:${String(to || '').trim()}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

/** Texto padrão da mensagem (sem dados clínicos: só quem é o paciente e a data do exame, se houver). */
export function messageText(exam, dateText, senderName = '') {
  const base = `Laudo de ultrassonografia de ${exam.patient.name || 'paciente'}${dateText ? ` (${dateText})` : ''}.`;
  return `${base} Segue em anexo o PDF.${senderName ? `\n${senderName}` : ''}`;
}
