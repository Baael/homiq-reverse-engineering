# Publikacja GitHub Wiki

GitHub Wiki to osobne repo: `<twoj-repo>.wiki.git`. W tym projekcie trzymamy źródła wiki w katalogu `wiki/`.

## Opcja A (zalecane): skrypt publish

W repo uruchom:

```bash
./scripts/publish_wiki.sh
```

Skrypt:

- wykryje `origin` i domyślną gałąź
- podmieni placeholdery `{{REPO_URL}}` i `{{DEFAULT_BRANCH}}`
- wypchnie strony do `origin.wiki.git`

## Opcja B: ręcznie

1. Włącz Wiki w ustawieniach repo na GitHub.
2. Sklonuj wiki:

```bash
git clone <URL_DO_REPO>.wiki.git
```

3. Skopiuj pliki z `wiki/` do katalogu wiki (root), zrób commit i push.

