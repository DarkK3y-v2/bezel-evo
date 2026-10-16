# Deixe o Bezel abrir a tela

[English](../permissions.md)

O Studio e o Light nunca pedem direitos de administrador e nunca instalam
drivers. A maioria das telas funciona assim que é conectada; algumas precisam de
um driver, uma vez.

- **Telas seriais** (Turing rev A e rev C, XuanFang, Kipye, WeAct): o driver do
  próprio Windows (usbser) cuida delas; elas aparecem como portas COM. Nada a
  instalar.
- **Geração Turing USB (id USB `1CBE:xxxx`) e painéis WCH (`43A8:xxxx`):** precisam
  do driver WinUSB. Se o seletor de telas do Studio (ou o `bezel devices`) não
  lista a tela e o Gerenciador de Dispositivos a mostra sem driver:
  1. Baixe o Zadig em [zadig.akeo.ie](https://zadig.akeo.ie).
  2. No Zadig, escolha **Options → List All Devices** e depois a tela na lista
     (confira que o USB ID começa com `1CBE` ou `43A8`).
  3. Escolha **WinUSB** como driver e clique em **Install Driver** (ou
     **Replace Driver**).

  Para desfazer, abra o Gerenciador de Dispositivos, clique com o botão direito
  na tela, escolha **Desinstalar dispositivo** e marque a opção que apaga o
  driver.
- **Painéis Turing USB no modo desktop** usam o driver HID do Windows: nada a
  instalar. Veja [Telas suportadas](devices.md#modo-desktop).
- **Sensores:** temperatura da CPU, ventoinhas e potência vêm do leitor de
  sensores de hardware incluso. O Setup o configura (o único passo que pede
  aprovação de administrador); veja
  [Sensores](sensors.md#o-leitor-de-sensores-de-hardware).

Só um programa pode usar uma tela por vez. Se o Bezel disser que a tela está em
uso, feche antes o outro programa:
[Solução de problemas](troubleshooting.md#a-tela-está-em-uso-access-denied).
