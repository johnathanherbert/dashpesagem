# Planilha Sync — Integração dashpesagem

Aplicação Python **standalone** (sem necessidade de Python instalado no destino) que monitora planilhas Excel e sincroniza automaticamente o banco de dados PostgreSQL do **dashpesagem** sempre que uma planilha for atualizada.

---

## Arquitetura

```
planilha-sync/
├── launcher.py              # Ponto de entrada (main)
├── build.py                 # Build PyInstaller
├── requirements.txt         # Dependências Python
├── .env.example             # Template de variáveis de ambiente
├── app/
│   ├── config.py            # Configurações centrais
│   ├── parser.py            # Leitura e processamento das planilhas
│   ├── db.py                # Acesso ao PostgreSQL (pool de conexões)
│   ├── sync.py              # Orquestra parser + db
│   ├── watcher.py           # Monitor de mudanças (polling mtime)
│   └── tray.py              # Ícone na bandeja do sistema
├── build_assets/
│   └── rthooks/
│       └── pyi_rth_pyarrow_compat.py
└── logs/                    # Criado automaticamente na execução
    └── planilha_sync.log
```

## Como funciona

```
┌─────────────────────────────────────────────────────────┐
│  DATABASE_DIR (OneDrive / Pasta de rede)                │
│  ┌──────────┐  ┌────────────┐  ┌────────────────────┐  │
│  │ajuste.xlsx│  │*unit*.xlsx │  │*remessa*.xlsx      │  │
│  └────┬─────┘  └─────┬──────┘  └──────────┬─────────┘  │
└───────┼──────────────┼────────────────────┼────────────┘
        │ mtime change │                    │
        ▼              ▼                    ▼
   FileWatcher (polling a cada 30s)
        │              │                    │
        ▼              ▼                    ▼
   parser.py     parser.py           parser.py
   (estoque)  (valor_unitario)      (remessas)
        │              │                    │
        ▼              ▼                    ▼
   db.py — PostgreSQL (dashpesagem)
   ┌─────────────────┬──────────────────┬──────────┐
   │ aging_estoque   │ material_valores │ remessas │
   └─────────────────┴──────────────────┴──────────┘
```

## Planilhas monitoradas

| Planilha | Padrão padrão | Tabela PostgreSQL | Estratégia |
|---|---|---|---|
| Estoque | `ajuste.xlsx` | `aging_estoque` | **TRUNCATE + INSERT** (substitui tudo) |
| Valor Unitário | `*unit*.xlsx` | `material_valores` | **UPSERT** (adiciona/atualiza) |
| Remessas | `*remessa*.xlsx` | `remessas` | **TRUNCATE + INSERT** (substitui tudo) |

## Configuração

### 1. Variáveis de ambiente (`.env`)

Copie `.env.example` para `.env` e ajuste:

```bash
cp .env.example .env
```

Principais variáveis:

| Variável | Descrição | Padrão |
|---|---|---|
| `DATABASE_DIR` | Caminho para a pasta das planilhas | OneDrive padrão |
| `POSTGRES_HOST` | Host do PostgreSQL | `192.168.15.16` |
| `POSTGRES_PORT` | Porta | `5432` |
| `POSTGRES_USER` | Usuário | `postgres` |
| `POSTGRES_PASSWORD` | Senha | (configurada) |
| `POSTGRES_DB` | Nome do banco | `postgres` |
| `POLL_INTERVAL_SECONDS` | Intervalo de verificação | `30` |
| `LOG_LEVEL` | Nível de log | `INFO` |

## Execução em desenvolvimento

```bash
# 1. Criar e ativar virtualenv
python -m venv .venv
.venv\Scripts\activate          # Windows
source .venv/bin/activate       # Linux/macOS

# 2. Instalar dependências
pip install -r requirements.txt

# 3. Configurar .env
cp .env.example .env
# edite .env com seus valores

# 4. Executar
python launcher.py
```

## Build — gerar executável standalone

```bash
# Instalar dependências (incluindo PyInstaller)
pip install -r requirements.txt

# Build único arquivo .exe
python build.py --onefile

# Build pasta (mais rápido para iniciar)
python build.py --onedir

# Ambos
python build.py --all
```

O executável gerado ficará em `dist/planilha_sync.exe`.

### Distribuição

Copie para a máquina de destino:
- `dist/planilha_sync.exe` (onefile) **OU** a pasta `dist/planilha_sync/` (onedir)
- Um arquivo `.env` ao lado do executável com as configurações corretas

O serviço não requer Python instalado no computador de destino.

## Comportamento em runtime

1. **Ao iniciar**: executa sincronização imediata de todas as planilhas encontradas
2. **Em background**: verifica mudanças a cada `POLL_INTERVAL_SECONDS` segundos
3. **Ao detectar mudança**: processa e envia ao banco; só atualiza o estado salvo se o sync for bem-sucedido (retry automático)
4. **Bandeja do sistema**: ícone verde com opções:
   - *Sincronizar agora* — força sync imediato
   - *Abrir log* — abre `planilha_sync.log` no Notepad
   - *Encerrar* — para o serviço com segurança

## Logs

Os logs são salvos em `logs/planilha_sync.log` ao lado do executável, com rotação automática (5 MB × 5 arquivos de backup).

Formato:
```
[2026-08-28 10:30:00] INFO     launcher — Conexão com PostgreSQL OK.
[2026-08-28 10:30:01] INFO     app.parser — Lendo planilha de estoque: ajuste.xlsx (header_row=3)
[2026-08-28 10:30:03] INFO     app.parser — Planilha de estoque: 684 registros processados.
[2026-08-28 10:30:04] INFO     app.db — aging_estoque: 684 registros inseridos.
```

## Relação com aging_flask

Esta integração **reutiliza a mesma lógica de leitura** do `aging_flask/app/data_processing.py` adaptada para trabalhar com o PostgreSQL do dashpesagem, sem depender do Flask ou de qualquer servidor web.

| aging_flask | planilha-sync |
|---|---|
| `launcher.py` → Flask em background | `launcher.py` → Watcher em background |
| `config.py` → DATABASE_DIR | `app/config.py` → DATABASE_DIR + DB config |
| `data_processing.py` → pandas | `app/parser.py` → pandas (mesma lógica) |
| In-memory cache | PostgreSQL direto |
| Sistema de tray (pystray) | Sistema de tray (pystray) |
| Build via `build.py` + PyInstaller | Build via `build.py` + PyInstaller |
