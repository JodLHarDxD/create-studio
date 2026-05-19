#!/usr/bin/env bash
# Install repo git hooks into .git/hooks/.
#
# Run once after cloning the repo:
#   bash scripts/setup-hooks.sh
#
# Re-run any time scripts/git-hooks/ changes. Existing hooks are
# overwritten (no merge logic — these are the canonical versions).

set -euo pipefail

# Resolve repo root (works whether invoked from root or scripts/)
repo_root="$(git rev-parse --show-toplevel 2>/dev/null)" || {
  echo "error: not inside a git repo" >&2
  exit 1
}

src_dir="$repo_root/scripts/git-hooks"
dst_dir="$repo_root/.git/hooks"

if [[ ! -d "$src_dir" ]]; then
  echo "error: $src_dir not found" >&2
  exit 1
fi
mkdir -p "$dst_dir"

shopt -s nullglob
installed=0
for src in "$src_dir"/*; do
  name="$(basename "$src")"
  # Skip subdirs, readmes, .md
  if [[ -d "$src" || "$name" == README* || "$name" == *.md ]]; then continue; fi

  cp "$src" "$dst_dir/$name"
  chmod +x "$dst_dir/$name"
  echo "  ✓ installed $name"
  installed=$((installed + 1))
done

if (( installed == 0 )); then
  echo "warn: no hooks found in $src_dir" >&2
else
  echo "done — $installed hook(s) installed into .git/hooks/"
fi
