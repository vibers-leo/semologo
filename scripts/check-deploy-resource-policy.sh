#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/vibers-deploy-resource-check.sh"
vibers_resource_ok 6291456 0 0 0
vibers_resource_ok 5242880 999 99 128
! vibers_resource_ok 5242879 0 0 0
! vibers_resource_ok 6291456 1000 0 0
! vibers_resource_ok 6291456 0 100 0
! vibers_resource_ok 6291456 0 0 129
! vibers_resource_ok invalid 0 0 0
! vibers_resource_ok 6291456 0 0 0 6291456
printf 'PASS resource policy: build cap + 1GiB reserve, PSI, swap I/O and input validation\n'
