# dsh-wiki-bridge

**WikiBridge**：DeepSeek Harness (DSH) 与 Obsidian vault 的知识库桥接插件 —— 会话中沉淀知识、检索旧结论、自动注入上下文，并把 `_约定.md` 式的归档规范变成可执行的工作流。

## 功能

### 模型工具（Host）

| 工具 | 作用 |
|---|---|
| `wiki_search` | 全文检索（相关度排序 + 命中处摘要），排除元文件 |
| `wiki_read` | 读取单篇笔记完整 Markdown |
| `wiki_write` | 约束写入：自动 frontmatter、标签白名单校验、查重询问、默认写收件箱、`confirmed` 智能确认 |
| `wiki_check` | 知识库体检：断链 / frontmatter / 双链 / 首页登记 / 标签白名单 / 超长行数 |
| `wiki_archive` | 周维护归档：收件箱 → 分类目录 → 刷新 frontmatter → 自动登记首页 |

### 自动词典（主题词门控上下文注入）

- `agent/pre-step` 监听：对话命中 vault 标题/标签/关键词时自动注入 top-3 笔记摘要（加权匹配：标题 3 / 标签 2 / 正文 1）
- 闲聊零开销（不命中不注入）；同回合只注入一次；按 agent 去重
- 索引缓存按文件 version 失效，vault 变大不重复读取

### 设置页（Client）

- 设置 → WikiBridge：vault 路径（自动发现 + 手动）、写入确认、常驻指引、自动词典开关
- **零补丁架构**：client 通过插件自注册的 HTTP 路由 `/api/wiki-bridge/config` 通信（`webServer.register`），host 内部写 settings 持久化 —— 不依赖 `settings-not-exposed` allowlist，不修改 DSH 主安装，升级安全

### 写入约束（内建 `_约定.md` 规范）

- 自动生成 frontmatter（title/created/updated/tags），日期由 host 填写
- 文件名中文短名规范化；标签白名单校验（新标签询问）
- 查重：同名页面询问追加更新 vs 新建；默认只写 `收件箱/`（铁律护栏）
- 元文件（`_约定.md` 等）排除出搜索与词典
- 凭据脱敏：写入前自动掩码 API Key/Token/私钥（返回 `redactedCount`）

### 知识生命周期（收件箱 → 分类 → 体检 → 遗忘）

```
① 沉淀（平时）        ② 归档（周维护）        ③ 体检（随时）      ④ 遗忘（衰减）
说"记一下"           说"做周维护"           说"体检一下"         超过阈值
    │                     │                      │                  │
wiki_write           wiki_archive           wiki_check          updated 距今
→ 收件箱/           → 分类目录 + 首页登记    → 7 项规范检查     > decayDays(90天)
（脱敏+白名单+查重）  （一次确认后执行）       （断链/frontmatter/  → 报告"可能过时"
                                            双链/登记/白名单/行数） → 人工裁决移入 归档/
```

- **`归档/` 遗忘区**：移入即移出知识面（词典/搜索/体检自动排除）
- **元文件**：`_约定.md`、`日志.md`、`收件箱/说明.md` 不参与检索
- 阈值 `decayDays` 可在设置页调整（默认 90 天，最小 7 天）

## 🚀 开箱即用（5 步从零到能用）

### 第 1 步：安装插件

```sh
dsh plugin --profile web add "github:<你的用户名>/dsh-wiki-bridge#main"
systemctl --user restart dsh-web
```

（或本地目录方式，见下方「安装」。）

### 第 2 步：准备 vault 约定

**已有 Obsidian vault**：把 `vault-template/_约定.md` 复制到 vault 根目录。

**全新 vault**：复制整个 `vault-template/` 的三样东西到 vault 根目录，并按需创建目录：

```text
你的Vault/
├── _约定.md          ← 从 vault-template/ 复制
├── 首页.md           ← 从 vault-template/ 复制（分类索引骨架）
├── 收件箱/           ← 新建空目录
├── 归档/             ← 新建空目录（遗忘区）
└── Caelestia/ 系统维护/ 网络/ 应用/ 服务/ 开发/   ← 分类目录（可增删，见模板 README 定制说明）
```

### 第 3 步：配置 vault 路径

打开 DSH **设置 → WikiBridge**：

1. 点「自动发现」（读取 Obsidian 注册表回填）或手动粘贴 vault 绝对路径
2. 点「保存」（持久化到 settings.yaml，立即生效）

### 第 4 步：验证

在 DSH 对话中说：

```
"体检一下知识库"   → wiki_check 返回检查结果（新 vault 应 0 问题）
```

### 第 5 步：日常使用

```
"记一下：xxx"           → 沉淀知识进收件箱
"查一下知识库有没有 xx"   → 检索复用旧结论
"做周维护/归档收件箱"     → 分类归档 + 登记首页
"体检一下知识库"         → 规范检查 + 按清单修复
```

> 对话命中知识库主题词时会自动注入相关笔记摘要（自动词典），无需手动检索。

## 安装

### 方式一：本地目录

```sh
cd ~/.dsh/profiles/web/plugins
git clone <本仓库>
cd ~/.dsh/profiles/web
pnpm install
# 编辑 package.json：dependencies 加 "dsh-wiki-bridge": "file:./plugins/dsh-wiki-bridge"
# dsh.profile.bundles 数组加 "dsh-wiki-bridge"
systemctl --user restart dsh-web
```

### 方式二：dsh plugin 命令（git 源）

```sh
dsh plugin --profile web add "github:<你的用户名>/dsh-wiki-bridge#main"
systemctl --user restart dsh-web
```

## 使用

```
"记一下：xxx"        → 沉淀知识（收件箱）
"查一下知识库有没有 xx" → 检索复用旧结论
"做周维护/归档收件箱"  → 分类归档 + 登记首页
"体检一下知识库"      → 规范检查 + 按清单修复
```

## 结构

```
lib/index.js     Host 半：工具 + 自动词典 + 索引 + HTTP 配置路由
lib/client.js    Client 半：设置页（ModuleLoader 格式）
cordis.patch.yml 插件行声明（dsh.bundle.patch）
```

## 依赖

- `schemastery` / `@deepseek-ai/dsh-settings` / `@deepseek-ai/dsh-tools`（运行时由 DSH 主安装解析）

## License

MIT
