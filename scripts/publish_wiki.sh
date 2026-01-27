#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WIKI_SRC_DIR="$ROOT_DIR/wiki"

if ! command -v git >/dev/null 2>&1; then
  echo "ERROR: git is required" >&2
  exit 1
fi

if [ ! -d "$WIKI_SRC_DIR" ]; then
  echo "ERROR: wiki source dir not found: $WIKI_SRC_DIR" >&2
  exit 1
fi

origin_url="$(git -C "$ROOT_DIR" remote get-url origin 2>/dev/null || true)"
if [ -z "${origin_url}" ]; then
  echo "ERROR: couldn't read git remote 'origin' (are you in a git repo?)" >&2
  exit 1
fi

default_branch="$(git -C "$ROOT_DIR" remote show origin 2>/dev/null | sed -n 's/^[[:space:]]*HEAD branch:[[:space:]]*//p' | head -n1 || true)"
default_branch="${default_branch:-main}"

repo_url=""
wiki_remote=""

if [[ "$origin_url" =~ ^git@github\.com:([^/]+)/([^/]+)(\.git)?$ ]]; then
  owner="${BASH_REMATCH[1]}"
  repo="${BASH_REMATCH[2]}"
  repo="${repo%.git}"
  repo_url="https://github.com/${owner}/${repo}"
  wiki_remote="git@github.com:${owner}/${repo}.wiki.git"
elif [[ "$origin_url" =~ ^https?://github\.com/([^/]+)/([^/]+)(\.git)?$ ]]; then
  owner="${BASH_REMATCH[1]}"
  repo="${BASH_REMATCH[2]}"
  repo="${repo%.git}"
  repo_url="https://github.com/${owner}/${repo}"
  wiki_remote="https://github.com/${owner}/${repo}.wiki.git"
else
  # Fallback: best-effort wiki remote + no repo_url templating.
  wiki_remote="${origin_url%.git}.wiki.git"
fi

tmp_dir="$(mktemp -d)"
cleanup() { rm -rf "$tmp_dir"; }
trap cleanup EXIT

echo "Origin:         $origin_url"
echo "Wiki remote:    $wiki_remote"
echo "Default branch: $default_branch"
if [ -n "$repo_url" ]; then
  echo "Repo URL:       $repo_url"
else
  echo "Repo URL:       (unknown; leaving {{REPO_URL}} placeholders as-is)"
fi

echo
echo "Cloning wiki..."
git clone --quiet "$wiki_remote" "$tmp_dir/wiki" || {
  echo "ERROR: failed to clone wiki repo. Ensure GitHub Wiki is enabled for the repository." >&2
  exit 1
}

echo "Rendering pages..."
shopt -s nullglob
for src in "$WIKI_SRC_DIR"/*.md; do
  base="$(basename "$src")"
  dst="$tmp_dir/wiki/$base"
  if [ -n "$repo_url" ]; then
    sed \
      -e "s|{{REPO_URL}}|$repo_url|g" \
      -e "s|{{DEFAULT_BRANCH}}|$default_branch|g" \
      "$src" >"$dst"
  else
    cp "$src" "$dst"
  fi
done
shopt -u nullglob

echo "Committing..."
git -C "$tmp_dir/wiki" add -A
if git -C "$tmp_dir/wiki" diff --cached --quiet; then
  echo "No changes to publish."
  exit 0
fi

git -C "$tmp_dir/wiki" commit -m "Update wiki from repo sources" --quiet
git -C "$tmp_dir/wiki" push --quiet

echo "Published."

