---
name: 生成可编辑标注的原型
description: This skill should be used when users want to create an interactive HTML prototype with editable annotations displayed in a right-side drawer. It generates a self-contained HTML page where every clickable component is automatically tagged with a sequence dot on the element and listed in a right-side drawer grouped by page section. Annotation text can be edited inline by double-clicking, and the final annotated prototype can be exported as a single HTML file. Trigger it for requests like "带标注的HTML原型", "可编辑标注原型", "annotated wireframe", "带说明的页面原型", "标注交互稿".
---

# 生成可编辑标注的原型

创建带标注且标注文本可编辑的 HTML 原型。输出的 HTML 是一个**自包含单文件**：内嵌标注引擎 v2（右侧抽屉式），每个可交互元素在自身右上角显示一个序号圆点，标注内容统一在页面右侧的抽屉浮窗内按页面区块分组展示，双击抽屉内卡片文本即可就地编辑，点击保存按钮可一键保存（回写标注并下载）单文件 HTML。

## 依赖与搭配

本 skill 仅负责**标注部分**（标注引擎、标注格式、区块分组、抽屉交互、保存）。原型的视觉设计规范不由本 skill 规定，按以下优先级取用：

| 优先级 | 来源 | 说明 |
|--------|------|------|
| 1 | 上游需求文档 | 需求文档中的设计规范（底色、排版、风格、组件样式等） |
| 2 | 专门的**设计规范 skill** | 搭配使用的设计规范 skill |
| 3 | 通用线框风 | 无上述时，按通用线框风自行实现 |

若未搭配设计规范 skill，生成的原型视觉风格由执行时自行决定，本 skill 不约束。

### 需求文档判断与采用

skill 触发时按以下顺序判断是否存在上游需求文档：

| 步骤 | 判断来源 | 做法 |
|------|----------|------|
| 1 | 工作区固定路径 | 探测常见文件名（不区分大小写）：`requirements.md` / `prd.md` / `需求文档.md` / `需求.md` / `PRD.md` / `requirement.md`；找到则记录为候选 |
| 2 | 用户消息 | 按下方"用户消息识别关键词清单"匹配；命中任一类别即判定为可能存在需求文档 |

**用户消息识别关键词清单**（步骤 2 用）：

| 类别 | 关键词 |
|------|--------|
| 文档名词 | 需求文档、需求规格、需求说明、需求描述、产品需求文档、PRD、prd、MRD、需求清单、需求列表 |
| 引导词 | 需求如下、这是需求、根据需求、按需求、参考需求、依照需求、需求是 |
| 相关制品 | 用户故事、user story、用例、use case、功能需求、功能清单、需求条目 |
| 文件信号 | 上传 `.md` / `.docx` / `.doc` / `.pdf` / `.txt` 文件 |
| 链接信号 | `feishu.cn`、`docs.qq.com`、`yuque.com`、`confluence`、`notion.so`、`shimo.im` 等在线文档链接 |
| 3 | 上游 skill 传入 | skill 链场景下，上游传入的需求文档参数 |
| 4 | 都未找到 | 主动询问用户"是否有需求文档？如有请提供文件、链接或粘贴文本" |

**采用确认**：判断到候选需求文档后，不直接采用，先告知用户"识别到需求文档：[来源/文件名]，是否采用其规范？"用户确认后才读取并按其规范执行；用户拒绝则用本 skill 兜底格式。

## 触发条件

满足以下任一情形即触发本 skill：

| 情形 | 典型表达 |
|------|----------|
| 显式要求"带标注的 HTML 原型" | "帮我做一个带标注的HTML原型" / "生成可编辑标注原型" |
| 要求原型上每处元素都有可编辑说明 | "页面原型上每个按钮都能加备注" / "交互稿，说明文字可改" |
| 要求 wireframe + annotation | "annotated wireframe" / "带 callout 的原型" |
| 要求右侧抽屉式标注 | "标注放右侧抽屉" / "按区块分组标注" |

**不触发**：纯静态 HTML 切图、无标注需求的页面、仅要设计稿图片导出。

## 执行逻辑

严格按以下五阶段执行，每阶段完成后再进入下一阶段。禁止跳过验证步骤。

### 阶段 1 · 需求解析

1. **判断上游需求文档**：按"工作区固定路径探测 → 用户消息识别 → 上游 skill 传入 → 主动询问"顺序判断是否存在需求文档（详见"依赖与搭配"章节）。判断到候选后告知用户来源并请求确认采用；用户确认则读取并按其规范执行，拒绝或无则用本 skill 兜底格式。
2. 从用户输入中提取五类信息：**页面主题**、**核心功能模块**、**目标设备（桌面端/移动端，默认桌面端）**、**风格倾向（线框/高保真，默认线框）**、**页面区块划分（若有需求文档则从中提取区块名，否则按功能模块自行划分）**。
3. 信息不足时，按"最少必要问题"原则一次性补问，最多一轮；若用户已给出页面主题，其余字段用默认值，不追问。
4. 输出一份**元素清单**（见 `references/annotation-standard.md` 第 5 节"元素清单格式"），列出每页每个区块内的可交互元素及其初步标注文案，区块名优先从需求文档提取。清单写入临时工作目录供后续校验。

### 阶段 2 · 生成原型 HTML

1. 生成一份**单文件 HTML**：所有 CSS 内联在 `<style>`，所有 JS 内联在 `<script>`，不依赖任何外部 CDN 或本地资源。
2. HTML 结构必须满足标注引擎 v2 的挂载约定（见下文"挂载约定"）。
3. 原型视觉设计规范（页面底色、排版、线框风/高保真风格、图标、图片占位、组件样式等）不由本 skill 规定，需搭配专门的**设计规范 skill** 使用；若无设计规范 skill，则按需求文档或通用线框风自行实现。本 skill 仅负责标注部分。
4. 多页面原型用 `<section data-page="pageId" data-page-title="页面名">` 切分；页面切换导航样式不由本 skill 规定，优先沿用上游需求文档的导航设计；无需求文档时生成简易导航（顶部固定栏 + 切换按钮，按钮 `onclick` 调用 `window.__annoGotoPage('pageId')`）。
5. 区块用 `<section data-annotate-section="区块名">` 标记，区块名优先取自需求文档。
6. 将该 HTML 写入 `/workspace/<prototype-name>.html`。

### 阶段 3 · 注入标注引擎

1. 将 `assets/annotation-engine.js` 的完整内容内联到原型 HTML 的 `</body>` 之前，包裹在 `<script>...</script>` 中。
2. 在 `<head>` 中注入 `assets/annotation-engine.css` 的完整内容。
3. 引擎会自动扫描挂载约定的元素并渲染右侧抽屉与页面元素序号圆点，**不需要手写每个元素的标注 DOM**。

#### 挂载约定（关键）

每个需要标注的可交互元素，在 HTML 中添加以下 data 属性：

```html
<button data-annotate="主操作按钮"
        data-annotate-type="action"
        data-annotate-detail="点击后提交表单并跳转至结果页">
  提交
</button>
```

| 属性 | 必填 | 作用于 | 说明 |
|------|------|--------|------|
| `data-annotate` | 是 | 可交互元素 | 标注主标题，抽屉卡片首行加粗显示 |
| `data-annotate-type` | 否 | 可交互元素 | 元素类型，决定序号圆点与卡片色条颜色（见标准第 2.4 节） |
| `data-annotate-detail` | 否 | 可交互元素 | 标注详情，抽屉卡片次行显示 |
| `data-annotate-section` | 否 | 区块容器 | 区块名，决定抽屉分组标题；优先取自需求文档 |
| `data-page` | 否 | 页面容器 | 页面 id，多页面切换用 |
| `data-page-title` | 否 | 页面容器 | 页面显示名，抽屉标题栏展示 |

完整示例：

```html
<section data-page="login" data-page-title="登录页">
  <section data-annotate-section="表单区">
    <input data-annotate="邮箱输入框" data-annotate-type="input"
           data-annotate-detail="输入登录邮箱,失焦校验格式">
    <button data-annotate="提交按钮" data-annotate-type="action"
            data-annotate-detail="点击提交表单,成功跳转首页">登录</button>
  </section>
</section>
```

无 `data-annotate` 属性的元素不会被标注。无 `data-annotate-section` 归属的标注归入抽屉的"其他"分组。

### 阶段 4 · 验证

执行 `scripts/validate_prototype.py` 对生成的 HTML 做静态校验，必须全部通过：

```bash
python3 scripts/validate_prototype.py /workspace/<prototype-name>.html
```

校验项（v2）：
- 单文件自包含（无外部资源引用）
- 标注引擎 JS 已注入（v2 抽屉式特征）
- 标注引擎 CSS 已注入（v2 抽屉式特征）
- 抽屉容器与按钮特征完整（保存/收起/展开）
- 每个 `data-annotate` 元素的标注文本非空且符合长度上限
- `data-annotate-type` 取值在允许枚举内
- `data-annotate-section` 区块标记格式正确（若存在）
- `data-page` 多页面标记格式正确（若存在）

任一项失败则回到阶段 2/3 修复，**最多重试 3 次**，仍失败则向用户报告具体失败项。

### 阶段 5 · 交付

1. 告知用户原型文件路径。
2. 说明标注交互方式：
   - 页面右侧抽屉浮窗按区块分组展示当前页所有标注，全页连续编号。
   - 元素右上角有序号圆点，点击圆点可在抽屉中定位对应卡片。
   - 点击抽屉卡片空白区可滚动定位到页面元素并高亮。
   - **双击**抽屉卡片文本 → 就地编辑 → 失焦/Enter 保存到 data 属性。
   - **双击**页面任意文字（标题、正文、按钮、表格内容等）→ 就地编辑 → 失焦/Enter 保存，Esc 取消；导出时保留修改。
   - 点击抽屉"隐藏圆点"按钮可隐藏/显示页面元素序号圆点。
3. 说明保存：点击抽屉右上角"保存"按钮，回写所有编辑并下载单文件 HTML（文件名加 `-annotated` 后缀）。
4. 说明收起/展开：点击抽屉右上角"收起"按钮收起抽屉，页面右下角出现"展开标注"按钮可重新展开。
5. 调用 `open_result_view` 呈现该 HTML 文件。

## 标注标准（摘要）

完整标准见 `references/annotation-standard.md`，此处仅列要点，执行时**必须**查阅完整标准：

**标注来源优先级**：标注内容（文案）与格式规范优先从上游需求文档获取；无需求文档或需求文档未规定时，采用本技能定义的兜底格式。需求文档与本标准冲突时以需求文档为准，并在元素清单中标注冲突项供确认。

- **元素识别**：仅标注可交互元素（按钮、链接、输入、图标按钮、导航项、卡片可点击区等）；带固定规则的标签文本、列表数据列（无交互）也需标注。
- **标注文案**：主标题 ≤ 12 字，名词性短语（表单/数据类取字段名称）；详情 ≤ 100 字，操作类描述"做什么 + 触发什么"，表单字段/数据列用结构化格式（表单字段：`字段名称|类型|规则/交互逻辑|必填|默认值`；数据列：`字段名称|类型|数据来源|说明`）；区块名 ≤ 20 字，名词性短语。
- **类型枚举**：`action` / `input` / `link` / `navigation` / `feedback` / `data`，对应六种配色。
- **区块分组**：当前页内按 `data-annotate-section` 分组，区块名优先取自需求文档；无归属标注归入"其他"分组；`data-annotate-section="全局"` 归入"全局"分组排最后。
- **序号编排**：全页连续编号 1-N（按抽屉显示顺序，保证抽屉内序号从小到大，与 DOM 顺序无关），切换页面后重新从 1 开始。
- **抽屉样式**：右侧固定浮窗，宽 320px，标题栏含页面名+标注数+保存/标注点显隐/收起按钮；收起后页面右下角显示展开按钮。
- **视觉样式**：标注抽屉/卡片/圆点样式详见标准文档第 3 节；原型视觉设计规范（底色、排版、线框风等）需另搭配设计规范 skill。

## 资源索引

| 文件 | 用途 | 何时加载 |
|------|------|----------|
| `references/annotation-standard.md` | 完整标注标准 v2 | 阶段 1、2、3 执行时必读 |
| `assets/annotation-engine.js` | 标注运行时引擎 v2（抽屉式） | 阶段 3 注入，无需读入上下文 |
| `assets/annotation-engine.css` | 标注运行时样式 v2（抽屉式） | 阶段 3 注入，无需读入上下文 |
| `scripts/validate_prototype.py` | 原型静态校验 v2 | 阶段 4 执行 |

## 输出位置

最终 HTML 一律写入 `/workspace/`，文件名用 kebab-case，如 `login-prototype.html`。
