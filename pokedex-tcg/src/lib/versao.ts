// Marcador de versão. Serve para responder, sem adivinhação, a pergunta
// "o que está no ar agora?" — o número aparece em Configurações.
// Suba este valor a cada atualização publicada.

export const VERSAO = '6.1';

export const MUDANCAS: string[] = [
  'Migração da coleção antiga para o novo padrão, com relatório',
  'Fonte de dados trocada para a TCGdex — cartas em português',
  'Busca por número virou acesso direto, sem erro 500',
  'Coleções em cache — tela de adicionar abre instantânea',
  'Telas carregadas sob demanda, app bem mais leve',
  'Álbum com destaque para cartas especiais',
  'Preço manual, sem conversão automática',
  'Coleção anterior memorizada no próximo cadastro',
  'Correção: gravação falhava em silêncio no Firestore',
];
