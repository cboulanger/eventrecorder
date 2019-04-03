#!/usr/bin/env bash
( qx serve --target=build & ) | while read output; do
  echo "$output"
  if echo "$output" | grep Compiled; then break; fi;
done
npx testcafe chrome,firefox tests/testcafe.js  --app-init-delay 10000
