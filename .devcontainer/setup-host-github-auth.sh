#!/usr/bin/env bash
set -euo pipefail

GH_CONFIG_DIR="${GH_CONFIG_DIR:-/home/vscode/.config/gh}"
HOST_GITCONFIG="/home/vscode/.gitconfig-host"
MANAGED_GITCONFIG="${HOME}/.gitconfig.devcontainer-host-github"
GITHUB_HELPER="!gh auth git-credential"

if ! git config --global --get-all include.path 2>/dev/null | grep -Fxq "${MANAGED_GITCONFIG}"; then
  git config --global --add include.path "${MANAGED_GITCONFIG}"
fi

{
  echo "# Managed by .devcontainer/setup-host-github-auth.sh"

  if [ -f "${HOST_GITCONFIG}" ]; then
    echo "[include]"
    echo "    path = ${HOST_GITCONFIG}"
  else
    echo "# Host git config not mounted at ${HOST_GITCONFIG}"
  fi

  echo "[credential \"https://github.com\"]"
  echo "    helper = ${GITHUB_HELPER}"
  echo "[credential \"https://gist.github.com\"]"
  echo "    helper = ${GITHUB_HELPER}"
} > "${MANAGED_GITCONFIG}"

chmod 600 "${MANAGED_GITCONFIG}"

if [ -f "${GH_CONFIG_DIR}/hosts.yml" ]; then
  echo "Using host gh auth from ${GH_CONFIG_DIR}."
else
  echo "Host gh auth was not found at ${GH_CONFIG_DIR}/hosts.yml. Run 'gh auth login' in WSL and rebuild the container." >&2
fi
