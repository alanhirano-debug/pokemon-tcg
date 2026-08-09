// Marcador de versão. Serve para responder, sem adivinhação, a pergunta
// "o que está no ar agora?" — o número aparece em Configurações.
// Suba este valor a cada atualização publicada.

export const VERSAO = '5.0';

export const MUDANCAS: string[] = [
  'Álbum com destaque para cartas especiais',
  'Preço manual, sem conversão automática',
  'Coleção anterior memorizada no próximo cadastro',
  'Correção: gravação falhava em silêncio no Firestore',
];
