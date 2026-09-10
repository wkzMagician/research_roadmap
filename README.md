# Readmap · LLM Research Roadmap

一个以资料依赖关系为核心的可视化阅读路线图。

## Run locally

需要 Node.js 20.19+（安装官网最新 LTS 即可）。进入本目录后运行：

```powershell
npm install
npm run dev
```

然后打开终端提示的本地地址（通常是 <http://localhost:5173>）。生产构建使用 `npm run build`，预览使用 `npm run preview`。

### 非程序员：双击启动

在 Windows 中直接双击 [`启动应用.bat`](./启动应用.bat)。首次使用时，它会检查 Node.js、自动安装应用所需组件，并在浏览器打开路线图；以后双击即可启动。Node.js 只需安装一次，选择官网的 LTS 版本即可。

停止应用时，关闭标题为 `Readmap server` 的命令行窗口。

### 非程序员：生成部署包

双击 [`生成部署包.bat`](./生成部署包.bat) 会生成 `dist` 文件夹。随后可打开 [Netlify Drop](https://app.netlify.com/drop)，将整个 `dist` 文件夹拖入页面，即可得到可分享的网址。静态部署适合浏览路线图，但浏览器无法改写服务器上的 JSON，因此在线编辑不会持久保存；需要编辑并同步 JSON 时请使用本地的一键启动方式。

## Public deployment

最省心的长期方案是 Vercel：将项目放到 GitHub 后，登录 [Vercel](https://vercel.com/new) 并选择该仓库。平台会自动识别 Vite；保留默认的 `npm run build` 构建命令和 `dist` 输出目录，点击 Deploy 即可。之后每次推送到 GitHub，Vercel 都会自动发布新版本。

## Roadmap 文件结构

所有路线图统一放在 `data/roadmaps/`，一份 roadmap 对应一个 JSON 文件：

```text
data/
└── roadmaps/
    ├── agent-systems-research-landscape-v1.json
    ├── another-roadmap.json
    └── ...
```

文件名必须与 JSON 中的 `meta.id` 完全相同。例如：

```json
{
  "meta": {
    "id": "another-roadmap",
    "title": "另一份 Roadmap"
  },
  "resources": [
    {
      "id": "react",
      "title": "ReAct: Synergizing Reasoning and Acting in Language Models",
      "url": "https://arxiv.org/abs/2210.03629",
      "read": false
    }
  ],
  "nodes": [
    {
      "id": "foundation",
      "title": "Agent 基础",
      "resources": ["react"]
    }
  ],
  "edges": []
}
```

该文件必须命名为 `data/roadmaps/another-roadmap.json`。`meta.id` 只使用字母、数字、连字符和下划线，且不要随意修改；它同时是文件名、切换标识和保存地址。

每份 JSON 的字段：

- `meta`：稳定的 roadmap `id` 与页面 `title`。
- `resources`：全局唯一的资料表，只保存 `id`、`title`、`url` 与 `read`。
- `nodes`：节点 `id`、标题及其资料 ID 列表。同一资料可以被多个节点引用，但标题、链接和阅读状态只保存一份。
- `edges`：唯一的有向连接数组。`from` 是前置节点，`to` 是后置节点。

JSON 不保存 layer、节点顺序、坐标或其他布局信息。React 页面会根据 `edges` 使用 Kahn 拓扑排序，动态计算从左到右的层级；每条箭头都表示“前置 → 后置”。

页面顶部的下拉框用于切换不同 roadmap，并会记住上次选择。点击“加载 JSON”会按其中的 `meta.id` 新建或更新 `data/roadmaps/<meta.id>.json`。网页端的编辑与阅读状态会直接写回当前选中的 JSON；未变更的内容不会重复写入。

如果直接把新文件复制进 `data/roadmaps/`，刷新网页即可在下拉框中看到它。格式错误、文件名与 `meta.id` 不一致的文件会被忽略，避免一份草稿影响其他 roadmap。

## Page editor

点击顶部 `Edit` 进入编辑模式：

- `Edit details` 修改 roadmap 标题。
- `+ Add node` 或节点上的 `Edit node` / `Delete` 管理节点。
- 节点编辑器可以调整前置节点，图会立即重新进行拓扑分层。
- 节点内可以新增、编辑、删除资料，以及修改资料标题、URL 和已读状态。
- 页面编辑内容会直接同步回 JSON，无需导出。

## Project origin

目标目录由 `D:\FantasyProjects\gh-repoflow` 初始化器准备；页面使用 React + Vite。
