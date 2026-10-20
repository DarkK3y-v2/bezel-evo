# Sensores

[English](../sensors.md)

O Bezel lê os sensores do computador por conta própria: processador, placa de
vídeo, memória, discos, rede, placa-mãe e ventoinhas. No Studio eles ficam no
painel **Sensores**, por categoria, cada um com o valor atual e uma pequena
linha de histórico. Arraste um para a área de edição para mostrá-lo, ou sobre um
widget para ligá-lo.

Pelo terminal:

```powershell
bezel sensors                    # todos os sensores, com a chave de cada um
bezel sensors --watch 1          # atualiza a cada segundo, até Ctrl+C
bezel sensors --json             # para scripts
```

## O leitor de sensores de hardware

Uso da CPU, memória, discos e rede funcionam direto, e as placas NVIDIA pelo
driver delas. Temperaturas, ventoinhas, voltagens e potência vêm do **leitor de
sensores de hardware** que acompanha o Bezel Evo, feito com o
LibreHardwareMonitorLib. Você não precisa deixar outro programa de
monitoramento aberto.

- O **Setup** o configura quando você marca **Configure hardware sensors**; **Setup sensors** no menu
  Iniciar faz isso de novo depois. O ZIP portátil tem o `setup-evo-sensors.cmd` para o mesmo passo.
- É a única parte do Bezel que roda com direitos de administrador, como uma
  tarefa do seu usuário do Windows; o Studio e o Light continuam sem elevação e
  o iniciam quando precisam de leituras. Ele para sozinho 30 segundos depois que
  o último deles fecha.
- Ele só lê: nunca controla ventoinhas nem iluminação, e não instala drivers.
  Quais valores existem depende do seu hardware e dos drivers dele.

Um LibreHardwareMonitor externo já rodando com o servidor web dele
(`http://127.0.0.1:8085`) continua funcionando como alternativa. Configuração,
logs e como desfazer estão no
[guia do leitor de sensores](../../../apps/bezel-sensors-helper/README.md) (em
inglês).

## O estado dos sensores

O **indicador de sensores** na barra de status do Studio mostra como vão as
leituras:

- **sensores · 3 ms**, com ponto verde: tudo sendo lido (o tempo é quanto durou a
  última leitura);
- **sensores · 1 faltando**, amarelo: pelo menos um hardware está sem leituras;
- **sensores parados**, vermelho: nenhuma leitura de hardware.

Clique nele para ver os detalhes: cada hardware com a origem, o número de
sensores e um valor de exemplo, a hora da última leitura, e **Reiniciar Libre**,
que reinicia o leitor de sensores de hardware. Reiniciar pode recuperar um
dispositivo cujas leituras pararam (uma fonte Corsair por USB, por exemplo).
**Abrir Sensores** mostra o painel.

## Quando falta um valor

O Bezel nunca inventa um número. Um sensor que ele não consegue ler fica
*indisponível*: o tema mostra `—`, e o `bezel sensors` imprime o motivo ao lado
(em inglês).

| Sensor | Por que fica indisponível | O que fazer |
|---|---|---|
| Temperatura, ventoinhas, potência da CPU | o leitor de sensores de hardware não está configurado ou não está lendo | rode a opção **Configure hardware sensors** do Setup, depois **Reiniciar Libre** ([acima](#o-estado-dos-sensores)) |
| FPS de jogos | nenhuma ferramenta está medindo um jogo | veja [FPS de jogos](fps.md) |
| Ping | ainda sem resposta do destino do ping | confira a rede ou troque o destino (abaixo) |
| Volume, mudo e dispositivo de saída | nenhuma saída padrão disponível | conecte ou selecione uma saída nas configurações de som do Windows |
| Bateria e autonomia | sem bateria ou sem estimativa do Windows | desktops normalmente não têm bateria; a estimativa pode estar ausente durante a carga |

Um sensor que simplesmente não existe (sem segunda placa de vídeo) também fica
indisponível.

## Ping

O `net.ping` mede o tempo de ida e volta até `8.8.8.8`, por padrão, com uma
conexão TCP na porta 53 ou 443 (o Windows não deixa um programa enviar um eco
ICMP). O Bezel mede uma vez por segundo, e só enquanto algo que você vê usa o
ping:

- um tema com um elemento de `net.ping`, mostrado pelo Light, pelo `bezel run`
  ou pelo Studio (ao vivo na tela, ou no editor);
- a lista de sensores do Studio, enquanto ela mostra o ping (painel aberto e o
  ping não escondido pela busca);
- o `bezel sensors`, que lista todos os sensores.

Fora disso, nada é enviado ao destino do ping, e o `net.ping` aparece
indisponível (*"measured only while shown"*).

Troque o destino em **Preferências → Sensores** no Studio, ou com `--ping-host`
na linha de comando (`bezel run --ping-host 1.1.1.1 ...`).
