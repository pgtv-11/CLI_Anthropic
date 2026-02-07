# JARVIS — Hybrid Personal Assistant

> MCP + Claude Code + Google Cloud Platform

Assistente pessoal híbrido que utiliza o **Model Context Protocol** como espinha dorsal, **Claude Code CLI** como motor de engenharia, e **GCP** para escalabilidade.

## Arquitetura

```
┌─────────────────────────────────────────────────────┐
│                    jarvis.py (Router)                │
│         Classificação de Intenção por Patterns       │
├──────────┬──────────────────┬────────────────────────┤
│ Engenharia│   Conhecimento   │      Automação         │
│          │      (RAG)       │                        │
│ Claude   │ MCP Server →     │ MCP Tools →            │
│ Code CLI │ LanceDB → Haiku  │ subprocess validado    │
└──────────┴──────────────────┴────────────────────────┘
                      │
          ┌───────────┴───────────┐
          │    MCP Server (FastMCP)│
          │  ┌─────────────────┐  │
          │  │ Memory Tools    │  │
          │  │ System Control  │  │
          │  │ Resources/Logs  │  │
          │  │ Prompt Templates│  │
          │  └─────────────────┘  │
          └───────────────────────┘
```

## Quick Start

```bash
# 1. Clonar e instalar
chmod +x install.sh && ./install.sh

# 2. Configurar API key
export ANTHROPIC_API_KEY='sk-ant-...'

# 3. Usar
python jarvis.py                              # interativo
python jarvis.py "explique como funciona o auth.py"   # single-shot
```

## Estrutura

```
jarvis-core/
├── jarvis.py                 # Orquestrador (Router de intenções)
├── config/mcp_config.json    # Configuração MCP para Claude Code
├── .mcp.json                 # Auto-discovery MCP (project scope)
├── mcp_server/
│   ├── server.py             # Servidor FastMCP principal
│   ├── database.py           # Abstração LanceDB ↔ Vertex AI
│   └── tools/
│       └── system_control.py # Automação de sistema segura
├── deploy/
│   ├── Dockerfile            # Cloud Run optimizado com uv
│   └── deploy.sh             # Deploy automatizado GCP
├── data/                     # Banco vetorial local
└── logs/                     # Logs de atividade
```

## Roteamento de Intenções

| Padrão                    | Intenção    | Motor               |
|---------------------------|-------------|----------------------|
| refatore, debug, crie...  | Engenharia  | Claude Code CLI      |
| o que é, como funciona... | Conhecimento| MCP + Haiku (RAG)    |
| organize, execute, liste..| Automação   | MCP System Tools     |
| conversa geral            | Chat        | Haiku API            |

## Deploy GCP (Free Tier)

```bash
export GCP_PROJECT_ID=your-project
chmod +x deploy/deploy.sh && ./deploy/deploy.sh
```

O deploy usa Cloud Run com scale-to-zero, mantendo custos dentro do Free Tier.

## Segurança

- Allowlist de comandos de sistema (no shell operators)
- Validação contra path traversal
- Blocklist de padrões destrutivos
- Proteção de arquivos sensíveis (.env, .ssh, etc.)
- IAM authentication no Cloud Run
- Logs de auditoria em SQLite

## Variáveis de Ambiente

| Variável              | Descrição                          | Default  |
|-----------------------|------------------------------------|----------|
| `ANTHROPIC_API_KEY`   | API key da Anthropic               | —        |
| `JARVIS_ENV`          | `LOCAL` ou `PROD`                  | `LOCAL`  |
| `GCP_PROJECT_ID`      | ID do projeto GCP (para deploy)    | —        |
| `GCP_REGION`          | Região do Cloud Run                | us-central1 |
