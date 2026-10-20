# Vindo do turing-smart-screen-python

[English](../migrating.md)

O Bezel controla as mesmas telas que o
[turing-smart-screen-python](https://github.com/mathoudebine/turing-smart-screen-python)
e lê os temas dele. Os dois não podem rodar ao mesmo tempo.

## 1. Pare o outro programa

Dois programas na mesma tela misturam os dados, então o Bezel recusa uma porta
que outro programa está usando, por exemplo `access denied to COM5`.

- **Aberto num terminal:** aperte Ctrl+C lá.
- **Iniciado com o Windows:** feche-o pelo ícone da bandeja e tire-o de **Gerenciador de
  Tarefas → Aplicativos de inicialização** (ou do Agendador de Tarefas, se você o
  colocou lá).

O app do fabricante (TURZX / Turing) também segura a tela: feche-o pelo ícone da
bandeja antes de usar o Bezel.

## 2. Traga os seus temas

No Studio: **Temas → Importar…** e escolha a pasta do tema (por exemplo
`res/themes/MeuTema` dentro do turing-smart-screen-python) ou o `theme.yaml`
dele. O tema importado abre na edição; clique em **Salvar** para guardá-lo na
sua biblioteca. O que não deu para converter exatamente (um sensor que o Bezel
não tem, uma fonte que ele não acha) aparece numa lista depois da importação.

Pelo terminal:

```powershell
bezel import turing-smart-screen-python/res/themes/MeuTema -o meutema.bezeltheme
bezel run meutema.bezeltheme
```

O `bezel run` e o `bezel render` também aceitam a pasta do tema direto e
convertem na hora. Os temas do app do fabricante (`.turtheme`) se importam do
mesmo jeito.

## 3. As suas configurações

| `config.yaml` | No Bezel |
|---|---|
| `COM_PORT` | achada sozinha; o seletor de telas do Studio (ou `--screen`) escolhe uma quando há várias telas conectadas |
| `REVISION` | detectada pela tela |
| `DISPLAY_REVERSE` | o botão de girar 180° na barra da área de edição do Studio; as orientações `-flipped` na linha de comando |
| `BRIGHTNESS` | **Tela → Ajustes → Brilho**, ou `bezel brightness 40` |
| `THEME` | o tema que você salva no Studio, que o Light roda: [Iniciar com o Windows](run-at-login.md) |
| `HW_SENSORS` | o Bezel lê os sensores sozinho, com o leitor de sensores de hardware incluso ([Sensores](sensors.md)) |
| `PING` | **Preferências → Sensores**, ou `--ping-host` |
