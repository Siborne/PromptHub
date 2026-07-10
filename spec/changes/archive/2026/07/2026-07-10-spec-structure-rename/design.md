# Design

## Directory Model

重构后的内部 SSD 结构：

```text
spec/
├── README.md
├── domains/
├── architecture/
├── logic/
├── assets/
├── issues/
└── changes/
```

## Rationale

### `domains/`

- 用于承载当前系统按领域划分的稳定行为真相
- 比 `specs/` 更容易理解，也更符合“system / desktop / web / skills”这种领域划分方式

### `assets/`

- 用于承载不会随着单个变更频繁改写的稳定资产信息
- 典型内容：平台支持矩阵、canonical 文件规则、命名规范清单、默认资源表

### `logic/`

- 用于承载需要长期查阅、但不适合写成纯需求 spec 的稳定逻辑
- 典型内容：规则工作台语义、平台根目录派生逻辑、同步语义拆解、对象关系说明

## Migration Rules

- `spec/specs/<domain>/spec.md` 全部迁移到 `spec/domains/<domain>/spec.md`
- `spec/changes/active/<change-key>/specs/<domain>/spec.md` 保持不变
- 所有文本引用统一替换到新路径
- SSD 规则文档增加如下职责划分：
  - `domains/`: 当前行为规格
  - `architecture/`: 长期工程结构与架构约束
  - `logic/`: 稳定逻辑语义与推导规则
  - `assets/`: 固定资产与长期资源清单

## Initial Durable Docs

### `spec/assets/agent-platforms.md`

记录：

- 当前支持的平台
- 各平台 root dir
- skills relative path
- global rule file
- config files

### `spec/logic/rules-workspace.md`

记录：

- `Rules` 模块的全局规则 / 项目规则分组语义
- 当前项目与手动项目目录的关系
- dynamic `project:<id>` 规则文件模型
- canonical 项目规则文件为何当前限定为 `AGENTS.md`
