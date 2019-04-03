#!/usr/bin/env bash
command -v testcafe || npm install -g testcafe
( qx serve --target=build & ) | while read output; do
  echo "$output"
  if echo "$output" | grep Compiled; then break; fi;
done
testcafe chrome,firefox,safari tests/testcafe.js  --app-init-delay 10000
