# Annotated Prototype Builder Skill（生成可编辑标注的原型 Skill）

创建带标注且标注文本可编辑的 HTML 原型。输出的 HTML 是一个**自包含单文件**：内嵌标注引擎 v2（右侧抽屉式），每个可交互元素在自身右上角显示一个序号圆点，标注内容统一在页面右侧的抽屉浮窗内按页面区块分组展示。

## 效果示例

在线体验标注原型效果（订单管理列表原型，含右侧标注抽屉、序号圆点、双击编辑等全部能力）：

[**打开效果示例**](https://workbuddy.link/p/mxCYUAyKQd2j9FEafKQhZ0?ext2=copy_link)

## 功能特性

- **右侧抽屉式标注**：标注统一在右侧浮窗按页面区块分组展示，全页连续编号
- **可编辑标注**：双击抽屉卡片文本就地编辑，失焦/Enter 保存，Esc 取消
- **页面文字可改**：双击原型内任意文字（标题、正文、按钮、表格内容等）就地编辑
- **双向联动**：点击卡片定位页面元素；点击页面元素序号圆点自动展开抽屉并定位卡片
- **全局分组**：`data-annotate-section="全局"` 的标注归入全局分组排最后
- **标注点显隐**：抽屉"隐藏圆点"按钮可切换页面元素序号圆点显隐
- **保存导出**：抽屉"保存"按钮回写所有编辑并下载单文件 HTML
- **多页面支持**：`data-page` 切分页面，抽屉跟随当前页自动刷新
- **业务逻辑标注**：结构化格式（类型/规则/必填/默认值）+ 三段式规则表达 + 前置条件/异常/权限/流转前缀段落
- **静态校验**：`validate_prototype.py` 校验原型标注规范性

## 挂载约定

| 属性 | 必填 | 作用于 | 说明 |
|------|------|--------|------|
| `data-annotate` | 是 | 可交互元素 | 标注主标题，≤12 字 |
| `data-annotate-type` | 否 | 可交互元素 | 类型枚举：action/input/link/navigation/feedback/data |
| `data-annotate-detail` | 否 | 可交互元素 | 标注详情，≤300 字；表单字段/数据列用结构化格式 |
| `data-annotate-section` | 否 | 区块容器 | 区块名，决定抽屉分组标题；`"全局"` 排最后 |
| `data-page` | 否 | 页面容器 | 页面 id，多页面切换用 |
| `data-page-title` | 否 | 页面容器 | 页面显示名，抽屉标题栏展示 |

示例：

```html
<section data-page="login" data-page-title="登录页">
  <section data-annotate-section="表单区">
    <input data-annotate="用户名" data-annotate-type="input"
           data-annotate-detail="类型：文本 | 规则/交互逻辑：长度2-10位，仅中文/英文 | 必填：是 | 默认值：空">
    <button data-annotate="提交按钮" data-annotate-type="action"
            data-annotate-detail="点击提交表单,成功跳转首页">登录</button>
  </section>
</section>
```

## 目录结构

```
annotated-prototype-builder-skill/
├── SKILL.md                          # 技能定义（触发条件、执行逻辑、挂载约定）
├── CHANGELOG.md                      # 更新记录
├── references/
│   └── annotation-standard.md        # 完整标注标准（元素识别、文案规范、结构化格式、交互行为、多页面处理）
├── assets/
│   ├── annotation-engine.js          # 标注运行时引擎 v2（抽屉式）
│   └── annotation-engine.css         # 标注运行时样式 v2
└── scripts/
    └── validate_prototype.py         # 原型静态校验脚本
```

## 使用方法

本技能为**通用 skill**，适用于支持技能系统（Agent Skill）的各类助手与平台。安装与使用：

1. 将 `SKILL.md` 与子目录（`references/`、`assets/`、`scripts/`）放入所在平台的技能目录（用户级或项目级技能目录）。
2. 向助手发出请求，例如："帮我做一个带标注的HTML原型" / "生成可编辑标注原型" / "带说明的页面原型"。
3. 技能按五阶段执行：需求解析 → 生成原型 HTML → 注入标注引擎 → 静态校验 → 交付。
4. 原型页面右侧抽屉展示标注；"保存"按钮下载带编辑结果的单文件 HTML。

## 版本更新记录

| 版本 | 日期 | 说明 |
|------|------|------|
| v1.1 | 2026-08-03 | 结构化格式优化（字段前缀、必填是/否、去掉字段名、默认值字样）；业务逻辑标注 10 项；详情上限 300 字、抽屉 480px；项目重命名 |
| v2.0.0 | 2026-08-02 | 抽屉式重构：全局分组、序号重排、标注点显隐、页面文字编辑、多页面支持、结构化格式引入 |
| v1.0.0 | — | 初始版本（气泡式标注） |

完整变更记录见 [CHANGELOG.md](CHANGELOG.md)。

## License

Apache License 2.0
