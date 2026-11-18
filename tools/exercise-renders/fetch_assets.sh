#!/usr/bin/env bash
# Downloads the avatar (Microsoft Rocketbox Sports_Male_04, MIT licence) into work/ -- kept out of git.
set -euo pipefail
D="$(dirname "$0")/work/assets/rocketbox/Sports_Male_04"
BASE="https://raw.githubusercontent.com/microsoft/Microsoft-Rocketbox/master"
mkdir -p "$D/Textures"
curl -sSL -o "$D/../LICENSE.md" "$BASE/LICENSE.md"
curl -sSL -o "$D/Sports_Male_04.fbx" "$BASE/Assets/Avatars/Professions/Sports_Male_04/Export/Sports_Male_04.fbx"
for n in body_color body_normal body_specular head_color head_normal head_specular; do
  curl -sSL -o "$D/Textures/m026_$n.tga" "$BASE/Assets/Avatars/Professions/Sports_Male_04/Textures/m026_$n.tga"
done
echo "Fetched into $D"
