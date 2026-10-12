#!/usr/bin/env bash
# One queued webhook deployment at a time; leave RAM/CPU for production services.
set -Eeuo pipefail
umask 077
app=${1:-}
[[ "$app" =~ ^[a-z0-9][a-z0-9-]{0,79}$ ]] || exit 64
log=/tmp/${app}-deploy.log
status=/tmp/${app}-deploy.status
exec 9>"/var/lock/${app}-deploy.lock"
flock -w 3600 9 || exit 75
printf 'QUEUED\n' >"$status"
exec 8>/var/lock/vibers-deploy-global.lock
if ! flock -w 3600 8; then printf 'FAILED: global deployment queue timeout\n' >"$status"; exit 75; fi
# Log truncation occurs only after both locks, never while an earlier deployment runs.
: >"$log"
exec > >(/root/scripts/redact-secrets.sh >>"$log") 2>&1
# Gate on current pressure and I/O, not historical occupied swap pages.
source /root/scripts/vibers-deploy-resource-check.sh
read -r builder_memory builder_swap < <(docker inspect buildx_buildkit_vibers-guarded0 --format '{{.HostConfig.Memory}} {{.HostConfig.MemorySwap}}')
if [[ "$builder_memory" != 4294967296 || "$builder_swap" != 4294967296 ]]; then
 printf 'FAILED: builder must have a 4GiB memory cap and no additional swap allowance\n' >"$status"
 exit 75
fi
builder_started=0
cleanup_builder() {
 local result=$?
 trap - EXIT
 if (( builder_started == 1 )); then
  # This process still owns the global deployment lock.
  docker buildx stop vibers-guarded || printf 'WARNING: idle builder stop failed\n'
 fi
 exit "$result"
}
trap cleanup_builder EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
ready=0
stable_samples=0
for ((attempt=0;attempt<120;attempt++)); do
 swap_before=$(awk '/^pswpin /{i=$2}/^pswpout /{o=$2}END{print i+o}' /proc/vmstat)
 sleep 1
 swap_after=$(awk '/^pswpin /{i=$2}/^pswpout /{o=$2}END{print i+o}' /proc/vmstat)
 swap_io=$((swap_after-swap_before))
 available=$(awk '/^MemAvailable:/{print $2}' /proc/meminfo)
 read -r some_pressure full_pressure < <(awk '/^some/{split($2,a,"=");s=int(a[2]*1000)} /^full/{split($2,a,"=");f=int(a[2]*1000)} END{print s,f}' /proc/pressure/memory)
 if vibers_resource_ok "$available" "$some_pressure" "$full_pressure" "$swap_io"; then
  stable_samples=$((stable_samples+1))
  if (( stable_samples >= 3 )); then ready=1; break; fi
 else
  stable_samples=0
 fi
 printf 'WAITING: available_kb=%s required_kb=5242880 psi_some_milli=%s psi_full_milli=%s swap_io_pages=%s stable=%s/3\n' "$available" "$some_pressure" "$full_pressure" "$swap_io" "$stable_samples"
 sleep 5
done
if (( ready == 0 )); then printf 'FAILED: insufficient production memory headroom or sustained pressure\n' >"$status"; exit 75; fi
builder_started=1
export VIBERS_DEPLOY_MANAGED=1
export BUILDX_BUILDER=vibers-guarded
export DOCKER_BUILDKIT=1
if [[ -f "/root/scripts/deploy-${app}.sh" ]]; then script="/root/scripts/deploy-${app}.sh"; else script=/root/scripts/webhook-deploy-generic.sh; fi
printf 'RUNNING\n' >"$status"
printf 'Guarded deploy: %s builder=%s\n' "$app" "$BUILDX_BUILDER"
# Parent keeps the locks. Long-lived grandchildren must not inherit them.
rc=0
nice -n 10 ionice -c 2 -n 7 bash "$script" "$app" 8>&- 9>&- || rc=$?
if (( rc != 0 )); then printf 'FAILED: guarded deploy exit %s\n' "$rc" >"$status"; fi
exit "$rc"
