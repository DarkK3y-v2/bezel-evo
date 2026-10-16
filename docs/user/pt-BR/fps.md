# FPS de jogos

[English](../fps.md)

O sensor `gpu.fps` (*Game frame rate*) mostra os quadros por segundo do jogo que
você está jogando. O Bezel não se injeta nos jogos: ele lê o que o RivaTuner
Statistics Server, uma ferramenta de FPS que você talvez já use, publica. Arraste o sensor para um tema como qualquer
outro.

> A leitura segue o formato publicado do RTSS, mas ainda não foi
> conferida com um jogo rodando (não validado no hardware). Se o valor parecer
> errado, avise.

## RivaTuner Statistics Server

1. Instale o RivaTuner Statistics Server (RTSS). Ele vem com o MSI Afterburner,
   ou sozinho.
2. Abra o RTSS e deixe-o rodando (ele pode ficar na bandeja).
3. Abra o jogo. O Bezel mostra o FPS do último jogo que o RTSS mediu.

Com o RTSS fechado, o sensor fica indisponível e diz isso ("RivaTuner Statistics
Server is not running: start it ...").

## O que aparece

- Um número enquanto o jogo roda. Um 0 informado pela ferramenta aparece como 0.
- `—` quando o RTSS não está medindo um jogo, ou quando o último valor
  tem mais de 3 segundos (jogo pausado, minimizado ou fechado). O Bezel nunca
  fica mostrando um valor velho.
