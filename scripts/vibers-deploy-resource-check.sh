#!/usr/bin/env bash
# Units: KiB available/cap; pressure is percent * 1000; swap I/O pages/sec.
# BuildKit is separately capped at 4 GiB with no additional swap allowance.
vibers_resource_ok() {
  local available=${1:-} some=${2:-} full=${3:-} swap_io=${4:-} cap=${5:-4194304}
  local value
  for value in "$available" "$some" "$full" "$swap_io" "$cap"; do
    [[ "$value" =~ ^[0-9]+$ ]] || return 2
  done
  (( cap > 0 && available >= cap + 1048576 && some < 1000 && full < 100 && swap_io <= 128 ))
}
if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  vibers_resource_ok "$@"
fi
