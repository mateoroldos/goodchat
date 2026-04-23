#!/bin/bash

while IFS= read -r line; do
  line="${line#"${line%%[![:space:]]*}"}"
  [[ -z "$line" || "$line" == \#* ]] && continue

  if [[ "$line" == ENVIRONMENT=* ]]; then
    bunx @railway/cli variables set ENVIRONMENT=production
  else
    bunx @railway/cli variables set "$line"
  fi
done <.env
