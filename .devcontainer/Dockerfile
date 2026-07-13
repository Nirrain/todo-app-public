FROM mcr.microsoft.com/devcontainers/python:3.12-bookworm

USER root

# Install minimal system dependencies
RUN rm -f /etc/apt/sources.list.d/yarn.list \
  && apt-get update \
  && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    git \
  && rm -rf /var/lib/apt/lists/*

# Install uv (fast Python package manager)
USER vscode
RUN curl -LsSf https://astral.sh/uv/install.sh | sh
ENV PATH="/home/vscode/.local/bin:/home/vscode/.cargo/bin:${PATH}"

# Install Claude Code CLI/Copilot
RUN curl -fsSL https://claude.ai/install.sh | bash

RUN curl -fsSL https://gh.io/copilot-install | bash

# Python best practices
ENV PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1