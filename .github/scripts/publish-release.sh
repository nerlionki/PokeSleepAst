#!/usr/bin/env bash
set -euo pipefail

tag="$1"
shift
version="${tag#v}"
version="${version%_hotfix}"
repo="${REPOSITORY:?}"

if ! gh release view "$tag" --repo "$repo" >/dev/null 2>&1; then
  # Both platform workflows can arrive here together; accept the other's draft.
  gh release create "$tag" --repo "$repo" --verify-tag --draft --generate-notes \
    --title "$tag" || gh release view "$tag" --repo "$repo" >/dev/null
fi
if test "$(gh release view "$tag" --repo "$repo" --json isDraft --jq .isDraft)" != true; then
  assets="$(gh release view "$tag" --repo "$repo" --json assets --jq '.assets[].name')"
  for name in "PokeSleepAst-$version.apk" "PokeSleepAst-$version-unsigned.ipa" update.json; do
    printf '%s\n' "$assets" | grep -Fxq "$name" || { echo "Published release is missing $name"; exit 1; }
  done
  echo 'Complete release is already public; keeping its immutable assets'
  exit 0
fi
gh release upload "$tag" "$@" --repo "$repo" --clobber
assets="$(gh release view "$tag" --repo "$repo" --json assets --jq '.assets[].name')"
for name in "PokeSleepAst-$version.apk" "PokeSleepAst-$version-unsigned.ipa" update.json; do
  if ! printf '%s\n' "$assets" | grep -Fxq "$name"; then
    echo "Draft is waiting for $name"
    exit 0
  fi
done
gh release edit "$tag" --repo "$repo" --draft=false --latest
