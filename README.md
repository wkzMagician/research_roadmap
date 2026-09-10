# Readmap

用 React + Vite 将研究资料组织为可编辑的阅读路线图。节点表示主题，箭头表示前置依赖，阅读状态保存到本地 JSON。

## 本地运行

需要 Node.js 20.19+（20.x）或 22.12+，以及 npm。

- Windows：双击 [start.bat](start.bat)。
- macOS / Linux：运行 `sh start.sh`。

脚本会在首次运行时安装依赖，并打开浏览器；按 Ctrl+C 停止服务。也可以手动运行：

```sh
npm ci
npm run dev -- --host 127.0.0.1 --open
```

## Agent：生成 Roadmap JSON

将文件写入 `data/roadmaps/<meta.id>.json`，使用 UTF-8（无 BOM）和合法 JSON，不要包含注释或 Markdown 围栏。现有完整示例：[Agent Systems 图谱](data/roadmaps/agent-systems-research-landscape-v1.json)。

推荐统一使用以下结构；此示例的文件名为 `agent-reading.json`：

```json
{
  "meta": { "id": "agent-reading", "title": "Agent 阅读路线" },
  "resources": [
    {
      "id": "react",
      "title": "ReAct: Synergizing Reasoning and Acting in Language Models",
      "url": "https://arxiv.org/abs/2210.03629",
      "read": false
    },
    {
      "id": "voyager",
      "title": "Voyager: An Open-Ended Embodied Agent with Large Language Models",
      "url": "https://arxiv.org/abs/2305.16291",
      "read": false
    }
  ],
  "nodes": [
    { "id": "foundation", "title": "推理与行动", "resources": ["react"] },
    { "id": "application", "title": "具身应用", "resources": ["voyager"] }
  ],
  "edges": [{ "from": "foundation", "to": "application" }]
}
```

### 字段约束

| 字段 | 生成要求 |
| --- | --- |
| `meta` | `id` 与文件名（不含 `.json`）完全一致，匹配 `^[a-z0-9][a-z0-9_-]{0,79}$`（不区分大小写）；`title` 为非空字符串。 |
| `resources` | 资料对象数组，每项包含 `id`、`title`、`url`、`read`。ID 在本图资料表中唯一，标题非空；URL 使用已核实的来源链接，无法核实时留空字符串；新资料的 `read` 为布尔值 `false`。 |
| `nodes` | 节点对象数组，每项包含唯一 `id`、非空 `title` 和 `resources` 资料 ID 数组；每个引用必须存在于资料表。同一资料可被多个节点引用。 |
| `edges` | `{ "from": "前置节点ID", "to": "后置节点ID" }` 数组；两端必须存在，禁止自环、重复边和循环依赖。无依赖时使用 `[]`。 |

所有 ID 使用稳定、无首尾空格的字符串。不要添加坐标、层级、样式、摘要等字段：页面自动计算布局，保存时只保留上述结构。

### 生成与检查步骤

1. 根据用户的研究主题和阅读目标选择真实资料，合并重复资料，为每份资料分配稳定 ID。
2. 按概念或学习阶段组织节点。只为必要的阅读前置关系连边，不要将相关性或发表时间直接当作依赖。
3. 输出完整 JSON；更新已有图时保留已有 ID 与 `read` 状态，避免覆盖用户的阅读进度。
4. 检查文件名、字段类型、ID 唯一性和引用完整性，并确认 `edges` 能完成拓扑排序。
5. 刷新本地页面，在下拉框中选择图谱并确认资料与依赖正确。也可用“加载 JSON”导入，按 `meta.id` 新建或更新文件。

本地开发服务会将网页编辑和阅读状态写回当前 JSON；Agent 修改同一文件时，应先结束网页编辑再刷新，避免互相覆盖。
