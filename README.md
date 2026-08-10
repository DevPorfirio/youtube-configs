# YouTube Configs

Extensao para Chrome e Firefox com configs personalizadas para o YouTube.

## Funcionalidades

- **Shorts como video normal** — links de Shorts abrem direto no player `/watch` (sem reload, historico correto), via interceptacao de `pushState`, rewrite de links e redirect precoce de navegacao
- **Esconder Shorts** — toggle global ou por local: menu lateral, home, busca, inscricoes, canais, sugestoes (watch) e trending
- **Pagina de video** — esconder videos recomendados e/ou painel de playlist (a playlist e preservada automaticamente quando a URL tem `list=`)
- **Layout com playlist** — quando os relacionados estao ocultos e a playlist esta visivel, descricao, comentarios e demais detalhes ocupam tambem a largura da playlist
- **Tamanho do player** — padrao do YouTube, medio (cabe na tela) ou largura total quando a lateral esta escondida
- **Velocidade ao segurar** — desabilita o 2x temporario ao segurar o mouse ou a barra de espaco; a barra de espaco alterna play/pause normalmente
- **Qualidade do video** — trava a qualidade em 480p/720p/1080p/1440p/4K; se o video nao tiver a escolhida, aplica a mais alta disponivel
- **Icone de estado** — fica cinza quando o toggle principal esta desligado

## Instalacao (desenvolvimento)

### Chrome

1. Acesse `chrome://extensions`
2. Ative o **Modo do desenvolvedor**
3. **Carregar sem compactacao** e selecione esta pasta

### Firefox

1. Acesse `about:debugging#/runtime/this-firefox`
2. **Carregar extensao temporaria** e selecione o `manifest.json`

## Estrutura

```
manifest.json          MV3 unico (Chrome + Firefox)
background.js          service worker: redirect de URL direta + icone de estado
content.js             rewrite de links, classes de contexto, expansao do player
page-hook.js           world MAIN: intercepta navegacao + qualidade + velocidade temporaria
features/hide-shorts.css
popup/                 interface dos toggles
_locales/              en + pt_BR
icons/                 svg fonte + pngs gerados
```

## Build

```bash
npx web-ext build   # gera o .zip para submissao (AMO/CWS)
npx web-ext lint    # valida o manifest
```

## Licenca

MIT
