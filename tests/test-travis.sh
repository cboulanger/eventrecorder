#!/usr/bin/env bash
export QX_TARGET=${QX_TARGET:-source}
echo "Running tests in ${QX_TARGET} mode..."
# start the server and wait for "Web server started" message
( qx serve --target=$QX_TARGET & ) | while read output; do
  echo "$output"
  if [[ $output == *"Web server started"* ]]; then break; fi;
done
npx testcafe chrome tests/testcafe.js  --app-init-delay 20000 || exit 1
# npx testcafe firefox tests/testcafe.js  --app-init-delay 20000 || exit 1
