#!/usr/bin/env bash
# install testcafe if not already installed
command -v testcafe || npm install -g testcafe
# start the server and wait for "Compiled X classes" message
( qx serve --target=build & ) | while read output; do
  echo "$output"
  if echo "$output" | grep Compiled; then break; fi;
done
# run tests
testcafe chrome,firefox,safari tests/testcafe.js  --app-init-delay 10000
# stop the server
kill %1
