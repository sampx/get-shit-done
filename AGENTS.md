# wsf — 项目规范

> **定位**：Claude Code / OpenCode / Gemini CLI / Codex 的 meta-prompting 与 spec-driven development 系统

---

## 1. 架构概览

WSF 通过安装器将命令、Agent、模板、工作流和 hooks 部署到目标 AI coding 工具的目录中。

### 核心组件关系

```
bin/install.js
  │
  ├── 检测 runtime (claude/opencode/gemini/codex)
  ├── 复制 assets 到目标目录:
  │   ├── commands/wsf/*.md   → 命令定义 (frontmatter + process)
  │   ├── agents/*.md         → Agent 定义 (subagent 角色)
  │   ├── wsf/      → 工作流引擎
  │   │   ├── workflows/*.md  → 工作流逻辑
  │   │   ├── templates/*.md  → 文档模板
  │   │   ├── references/*.md → 引用资料
  │   │   └── bin/wsf-tools.cjs → CLI 工具集
  │   └── hooks/              → Claude Code hooks (esbuild 打包)
  │
  └── 用户在项目中运行 /wsf-xxx 命令
        │
        ├── 触发 command/*.md 中的 process
        ├── 加载 workflow/*.md 执行逻辑
        ├── 调用 wsf-tools.cjs 处理状态/配置/git
        └── 生成 .planning/ 目录 (PROJECT/ROADMAP/STATE 等)
```

> 详细的安装流程和多 runtime 适配逻辑见 `bin/install.js`（2482 行）。

---

## 2. 目录与模块

```
/
├── bin/
│   └── install.js               # 安装器入口（npx 触发），处理 runtime 检测、文件复制、配置注入
├── commands/wsf/                # 命令定义文件（frontmatter YAML + process XML）
│   ├── new-project.md           # 核心：项目初始化
│   ├── discuss-phase.md         # 核心：阶段讨论
│   ├── plan-phase.md            # 核心：阶段规划
│   ├── execute-phase.md         # 核心：阶段执行（多 agent 并行）
│   ├── verify-work.md           # 核心：用户验收测试
│   ├── complete-milestone.md    # 里程碑完成
│   └── ... (30+ commands)
├── agents/                      # Subagent 角色定义
│   ├── wsf-executor.md          # 执行器：原子提交 + 偏差处理
│   ├── wsf-planner.md           # 规划器：XML 结构化计划
│   ├── wsf-phase-researcher.md  # 阶段研究
│   ├── wsf-project-researcher.md # 项目研究
│   ├── wsf-verifier.md          # 验证器
│   ├── wsf-debugger.md          # 调试器
│   └── ... (11 agents)
├── wsf/               # 工作流引擎核心
│   ├── bin/
│   │   ├── wsf-tools.cjs        # CLI 工具集（状态管理、配置、git 操作等）
│   │   └── lib/                 # wsf-tools 的模块化实现
│   │       ├── core.cjs         # 共享工具：路径、模型配置表、输出、配置加载
│   │       ├── config.cjs       # 配置 CRUD
│   │       ├── init.cjs         # 工作流初始化（execute-phase、new-project 等）
│   │       ├── state.cjs        # STATE.md 操作
│   │       ├── phase.cjs        # 阶段管理
│   │       ├── roadmap.cjs      # 路线图解析
│   │       ├── milestone.cjs    # 里程碑管理
│   │       ├── verify.cjs       # 验证逻辑
│   │       ├── template.cjs     # 模板处理
│   │       ├── frontmatter.cjs  # YAML frontmatter CRUD
│   │       └── commands.cjs     # 命令注册/分发
│   ├── workflows/               # 工作流逻辑（命令执行时加载）
│   │   ├── new-project.md       # 项目初始化流程
│   │   ├── execute-phase.md     # 阶段执行（wave 并行）
│   │   ├── plan-phase.md        # 规划流程
│   │   └── ... (30+ workflows)
│   ├── templates/               # 文档模板（PROJECT.md、ROADMAP.md 等）
│   └── references/              # 引用资料（配置模式、git 集成等）
├── hooks/                       # Claude Code hooks
│   ├── wsf-check-update.js      # 更新检查
│   ├── wsf-context-monitor.js   # 上下文监控
│   └── wsf-statusline.js        # 状态栏显示
├── scripts/
│   ├── build-hooks.js           # hooks 构建（复制到 dist/）
│   └── run-tests.cjs            # 跨平台测试运行器
├── tests/                       # 测试文件（Node.js test runner）
│   ├── core.test.cjs
│   ├── config.test.cjs
│   ├── phase.test.cjs
│   └── ... (16 test files)
└── docs/
    ├── USER-GUIDE.md            # 用户指南
    └── context-monitor.md       # 上下文监控文档
```

---

## 3. CLI 工具速查

`wsf-tools.cjs` 是核心 CLI，通过 `node wsf-tools.cjs <command>` 调用。

### 状态管理

```bash
wsf-tools state load                         # 加载配置 + 状态
wsf-tools state json                         # STATE.md frontmatter → JSON
wsf-tools state update <field> <value>       # 更新字段
wsf-tools state get [section]                # 获取内容/章节
wsf-tools state patch --field val ...        # 批量更新
wsf-tools state-snapshot                     # 结构化解析 STATE.md
```

### 模型与阶段

```bash
wsf-tools resolve-model <agent-type>         # 根据 profile 解析模型
wsf-tools find-phase <phase>                 # 按编号查找阶段目录
wsf-tools phase next-decimal <phase>         # 计算下一个小数阶段号
wsf-tools phase add <description>            # 追加阶段
wsf-tools phase insert <after> <description> # 插入阶段
wsf-tools phase remove <phase> [--force]     # 删除阶段并重新编号
wsf-tools phase complete <phase>             # 标记阶段完成
```

### Git 与提交

```bash
wsf-tools commit <message> [--files f1 f2]   # 提交计划文档
```

### 验证

```bash
wsf-tools verify-summary <path>              # 验证 SUMMARY.md
wsf-tools verify-path-exists <path>          # 检查文件/目录存在
wsf-tools validate consistency               # 检查阶段编号一致性
wsf-tools validate health [--repair]         # .planning/ 完整性检查
```

### 路线图与需求

```bash
wsf-tools roadmap get-phase <phase>          # 提取阶段章节
wsf-tools roadmap analyze                    # 完整路线图解析
wsf-tools requirements mark-complete <ids>   # 标记需求完成
```

### Frontmatter

```bash
wsf-tools frontmatter get <file> [--field k] # 提取 frontmatter
wsf-tools frontmatter set <file> --field k --value v
wsf-tools frontmatter merge <file> --data '{json}'
wsf-tools frontmatter validate <file> --schema plan|summary|verification
```

### 其他

```bash
wsf-tools generate-slug <text>               # 生成 URL-safe slug
wsf-tools current-timestamp [format]         # 获取时间戳 (full|date|filename)
wsf-tools list-todos [area]                  # 列出待办
wsf-tools history-digest                     # 聚合所有 SUMMARY.md
wsf-tools summary-extract <path> [--fields]  # 提取 SUMMARY 结构化数据
wsf-tools websearch <query> [--limit N]      # Brave API 搜索
```

---

## 4. 核心模块详解

### 4.1 安装器 (`bin/install.js`)

- 入口：`npx wsf-cc` 或 `wsf-cc`
- 参数：`--claude/--opencode/--gemini/--codex/--all` + `--global/--local`
- 逻辑：检测 runtime → 复制 files 到目标目录 → 注入 hooks 配置 → 处理 uninstall
- 目标目录映射：
  | Runtime | Global | Local |
  |---------|--------|-------|
  | Claude  | `~/.claude/` | `./.claude/` |
  | OpenCode | `~/.config/opencode/` | `./.opencode/` |
  | Gemini | `~/.gemini/` | `./.gemini/` |
  | Codex | `~/.codex/` | `./.codex/` |

### 4.2 命令系统 (`commands/wsf/*.md`)

- 格式：YAML frontmatter（name、description、argument-hint、allowed-tools）+ process XML
- frontmatter 定义命令元数据和权限
- process 通过 `@path` 引用 workflow 文件
- 命令通过 `/wsf-xxx` 在目标 runtime 中触发

#### WopalSpace 多项目空间约定

- 在 WopalSpace 这类多项目工作空间中，关键入口命令支持显式项目参数，例如：
  - `/wsf-map-codebase space-flow`
  - `/wsf-new-project space-flow`
  - `/wsf-discuss-phase 1 space-flow`
  - `/wsf-plan-phase 1 space-flow`
- 项目参数当前解析为 `projects/<name>/` 形态的子项目目录
- 当命令在工作空间根目录运行，且当前目录存在 `projects/` 但不存在 `.planning/` 时，`new-project` / `map-codebase` / `progress` / `phase-op` / `plan-phase` / `execute-phase` / `verify-work` 必须要求显式项目参数，禁止默认把工作空间根目录当作项目根
- 这类命令的 workflow 必须通过 `wsf-tools.cjs init ...` 吃到完整参数，并由工具层解析目标项目；不要在 workflow 内部自行猜测项目根

### 4.3 Agent 系统 (`agents/*.md`)

- 11 个 specialized agent，每个有 YAML frontmatter（name、description、tools、color）
- 核心 agent：executor、planner、verifier、researcher（×2）、debugger
- 辅助 agent：codebase-mapper、roadmapper、plan-checker、integration-checker、research-synthesizer
- 模型配置见 `core.cjs` 中的 `MODEL_PROFILES` 表

### 4.4 状态管理 (`wsf/bin/lib/`)

- 所有项目状态存储在 `.planning/` 目录
- 关键文件：`config.json`、`PROJECT.md`、`ROADMAP.md`、`STATE.md`、`REQUIREMENTS.md`
- 阶段目录：`.planning/{phase_num}-{phase_name}/`
  - `PLAN.md` — XML 结构化任务计划
  - `SUMMARY.md` — 执行结果
  - `CONTEXT.md` — 用户决策上下文

#### 项目根解析职责

- `findProjectRoot()` 的职责是：从已知项目目录或其子目录向上解析 `.planning/` 所属项目根
- “空间项目名 → 项目目录”的解析属于独立职责，由 `wsf-tools.cjs` + `core.cjs` 的共享 helper 处理，不应把这层语义硬塞进 `findProjectRoot()`
- 对于 WopalSpace 多项目空间，`init` 子命令先解析目标项目，再进入 `findProjectRoot()` / `loadConfig()` / `init.cjs` 逻辑

### 4.5 模型配置

| Agent | Quality | Balanced | Budget |
|-------|---------|----------|--------|
| wsf-planner | opus | opus | sonnet |
| wsf-executor | opus | sonnet | sonnet |
| wsf-phase-researcher | opus | sonnet | haiku |
| wsf-project-researcher | opus | sonnet | haiku |
| wsf-verifier | sonnet | sonnet | haiku |
| wsf-debugger | opus | sonnet | sonnet |
| wsf-plan-checker | sonnet | sonnet | haiku |

---

## 5. 开发规范

### 开发命令

```bash
npm run build:hooks     # 构建 hooks（复制到 hooks/dist/）
npm test                # 运行测试（Node.js test runner）
npm run test:coverage   # 测试 + 覆盖率（≥70% lines）
```

### 测试

- 框架：Node.js 内置 test runner（`--test`）
- 文件：`tests/*.test.cjs`
- 覆盖率：c8（`wsf/bin/lib/*.cjs`，阈值 70% lines）
- 运行器：`scripts/run-tests.cjs`（跨平台，自动发现测试文件）
- 涉及项目根解析、多项目空间支持、`--cwd` 透传时，至少更新：`tests/core.test.cjs`、`tests/init.test.cjs`、`tests/dispatcher.test.cjs`

### 本地测试安装

```bash
node bin/install.js --claude --local    # 安装到 ./.claude/
```

### 新增命令模板

```markdown
---
name: wsf-your-command
description: Brief description
argument-hint: "[flags]"
allowed-tools:
  - Read
  - Bash
  - Write
  - Task
  - AskUserQuestion
---
<context>
<!-- 条件、标志说明 -->
</context>

<objective>
<!-- 命令目标、创建的文件 -->
</objective>

<execution_context>
@~/.claude/wsf/workflows/your-workflow.md
</execution_context>

<process>
Execute the your-workflow workflow end-to-end.
</process>
```

### 新增 Agent 模板

```markdown
---
name: wsf-your-agent
description: Brief role description
tools: Read, Write, Edit, Bash, Grep, Glob
color: yellow
---

<role>
<!-- Agent 角色定义 -->
</role>
```

---

## 6. 代码约束

**代码风格**：
- 纯 Node.js CommonJS（`.cjs`），无 TypeScript、无 bundler（hooks 除外）
- 单文件测试，无测试框架依赖
- 安装器是纯 JS，无外部依赖

**安全红线**：
- **禁止提交**：`.env`、API 密钥、用户配置
- **禁止修改**：上游命令/Agent 的核心逻辑除非有明确理由

**Hooks 构建**：
- hooks 源文件在 `hooks/`，构建后到 `hooks/dist/`
- esbuild 仅用于 hooks 打包，核心库不用 bundler
- `prepublishOnly` 自动触发 `build:hooks`
