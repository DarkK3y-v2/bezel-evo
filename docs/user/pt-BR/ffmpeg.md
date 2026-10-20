# Instalar o ffmpeg

[English](../ffmpeg.md)

O Bezel usa o [ffmpeg](https://ffmpeg.org) para converter vídeos para o formato
da tela, e para tocar o vídeo de fundo de um tema em telas que não tocam vídeo
sozinhas. O ffmpeg não vem com o Bezel. Ele precisa ter o codificador H.264
`libx264`.

Sem o ffmpeg, imagens e vídeos que já estão no formato da tela continuam sendo
enviados; o Bezel avisa quando um vídeo precisa de conversão.

## Instalar

```powershell
winget install --id Gyan.FFmpeg -e
```

Depois feche e abra de novo o Studio, feche e reinicie o Light (e qualquer
terminal), para eles verem o `PATH` novo.

## Conferir

```powershell
ffmpeg -hide_banner -encoders | Select-String libx264
```

Uma linha com `libx264` quer dizer que está pronto.

## Um ffmpeg fora do PATH

- No Studio: **Tela → Armazenamento → Localizar ffmpeg…** (aparece quando o
  Bezel não acha um).
- Na linha de comando: `--ffmpeg CAMINHO`, o programa ou a pasta dele:

```powershell
bezel storage put clipe.mp4 --ffmpeg C:\Tools\ffmpeg\bin\ffmpeg.exe
```
