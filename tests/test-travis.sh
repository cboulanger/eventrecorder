#!/usr/bin/env bash
export QX_TARGET=${QX_TARGET:-source}
echo "Running tests in ${QX_TARGET} mode..."
( qx serve --target=$QX_TARGET & ) | while read output; do
  echo "$output"
  if echo "$output" | grep Compiled; then break; fi;
done
npx testcafe chrome tests/testcafe.js  --app-init-delay 20000 || exit 1
# npx testcafe firefox tests/testcafe.js  --app-init-delay 20000 || exit 1
