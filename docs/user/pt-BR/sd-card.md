# Preparar um cartão SD

[English](../sd-card.md)

As telas com entrada de cartão leem cartões **FAT32** com tabela de partição
**MBR**. O Bezel nunca formata o cartão: prepare-o no computador e depois
coloque na tela.

Cartões novos de até 32 GB costumam vir prontos (MBR e FAT32). Cartões maiores
vêm em exFAT, que a tela não lê: formate como abaixo. O Bezel foi testado com um
cartão de 32 GB.

**Formatar apaga tudo o que está no cartão.** Confira duas vezes que você
escolheu o cartão e não outro disco.

## Formatar no Windows

No Explorador de Arquivos, clique com o botão direito no cartão, escolha
**Formatar…**, selecione **FAT32** e clique em **Iniciar**. O Windows só oferece
FAT32 para cartões de até 32 GB; para um cartão maior, use um programa de
formatação FAT32.

## Na tela

1. Com a tela desconectada, coloque o cartão.
2. Conecte a tela de novo.
3. Confira se o Bezel o vê: **Tela → Armazenamento** mostra o **Cartão SD** com o
   tamanho dele, ou rode `bezel storage info`.

"Nenhum cartão SD na tela" quer dizer que a tela não achou um cartão que ela
consiga ler: confira se o cartão está em FAT32 com tabela de partição MBR.
