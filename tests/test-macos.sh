#!/usr/bin/env bash
export QX_TARGET=${QX_TARGET:-source}

# stop any running server
if [[ $(pgrep "qx serve") ]]; then kill -9 $(pgrep "qx serve"); fi

# install testcafe if not already installed
command -v testcafe || npm install -g testcafe

echo
echo "Running tests in ${QX_TARGET} mode..."

# start the server and wait for "Web server started" message
( qx serve --target=$QX_TARGET & ) | while read output; do
  echo "$output"
  if [[ $output == *"Web server started"* ]]; then break; fi;
done

# run tests
testcafe chrome tests/testcafe.js  --app-init-delay 20000
testcafe firefox tests/testcafe.js --app-init-delay 20000
testcafe safari tests/testcafe.js  --app-init-delay 20000

# stop the server
kill -9 $(pgrep "qx serve")
