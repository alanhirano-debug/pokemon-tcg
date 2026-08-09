// Marcador de versão. Serve para responder, sem adivinhação, a pergunta
// "o que está no ar agora?" — o número aparece em Configurações.
// Suba este valor a cada atualização publicada.

export const VERSAO = '6.2';

/** Momento em que este pacote foi compilado. */
export const BUILD_TIME = __BUILD_TIME__;

/** "09/08 às 23:41" — para conferir de relance se o deploy rodou. */
export function buildFormatado(): string {
  const d = new Date(BUILD_TIME);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

export const MUDANCAS: string[] = [
  'Coleções embutidas no app — a tela abre sem esperar a rede',
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
