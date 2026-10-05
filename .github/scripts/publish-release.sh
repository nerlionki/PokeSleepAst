#!/usr/bin/env bash
set -euo pipefail

tag="$1"
shift
version="${tag#v}"
repo="${REPOSITORY:?}"

if ! gh release view "$tag" --repo "$repo" >/dev/null 2>&1; then
  # Both platform workflows can arrive here together; accept the other's draft.
  gh release create "$tag" --repo "$repo" --verify-tag --draft --generate-notes \
    --title "宝睡小助手 $version" || gh release view "$tag" --repo "$repo" >/dev/null
fi
test "$(gh release view "$tag" --repo "$repo" --json isDraft --jq .isDraft)" = true || {
  echo 'Release is already public; immutable version cannot be overwritten'
  exit 1
}
gh release upload "$tag" "$@" --repo "$repo" --clobber
assets="$(gh release view "$tag" --repo "$repo" --json assets --jq '.assets[].name')"
for name in "PokeSleepAst-$version.apk" "PokeSleepAst-$version-unsigned.ipa" update.json; do
  if ! printf '%s\n' "$assets" | grep -Fxq "$name"; then
    echo "Draft is waiting for $name"
    exit 0
  fi
done
gh release edit "$tag" --repo "$repo" --draft=false --latest
