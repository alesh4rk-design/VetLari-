// Particularidades do laudo de ultrassonografia.
export const ULTRASOUND = {
  type: 'usg',
  regionLabel: 'Estrutura relacionada',
  /** Campos adicionais do passo "Achados" (nenhum além das estruturas). */
  techniqueHtml: () => '',
  findingsHint: 'Preencha apenas o que foi avaliado. Estruturas deixadas em branco não aparecem no laudo e nada é presumido como normal.',
};
