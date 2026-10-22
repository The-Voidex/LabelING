# LabelING v1 设计文档

日期：2026-10-23
状态：已确认（架构与核心规则已由用户确认，其余可按实现反馈微调）

## 1. 背景与目标

数据集标注在样本量大时极其耗时。LabelING 是一个本地运行的图像标注工具：导入未标注图片，配置支持提示词的视觉模型对每个类别做预标注，人工审核修正后导出训练格式。目标是替代 Roboflow 在本地小规模数据集上的核心工作流，模型可自由接入国产 OpenAI 兼容服务，不依赖境外充值渠道。

**核心闭环**：导入图片 → 配置类别与提示词 → 模型预标注 → 人工审核/修正 → 导出 YOLO / COCO。

## 2. v1 范围

**做**
- 矩形框目标检测标注（类别 + 框）。
- 项目管理：创建、重命名、删除。
- 类别管理：名称、颜色、提示词描述、排序。
- 图片导入：文件夹扫描，支持复制到项目目录或引用原路径；递归可选；重复图片检测。
- 图片网格：缩略图、分页、状态筛选、选择、批量操作。
- 标注工作台：画框、移动、缩放、删除、改类别、缩放/平移画布、撤销/重做、自动保存。
- 模型配置：多套配置，OpenAI 兼容接口（千问 / DeepSeek / 其他兼容服务）+ 模拟 Provider。
- 预标注：每张图一次请求、全类别（可只选部分类别）、异步任务、进度、取消、重试、逐图错误记录。
- 审核：未标注 / 待审核 / 已确认三态；逐张确认；批量接受预标注；撤销确认。
- 导出：YOLO txt（zip）与 COCO JSON（zip），可选范围与是否打包图片。
- 全中文界面与中文错误提示。

**不做（v1 明确排除）**
- 多边形/分割、关键点、旋转框、图像分类。
- 多人协作、账号、权限、局域网访问。
- 本地开放词表模型（Grounding DINO / YOLO-World）——Provider 接口预留，v1 不实现。
- 模型训练、数据集划分、主动学习、云端同步、桌面安装包。
- 视频/多帧、SAM 交互式分割。

## 3. 用户与场景

单机单用户（Windows），数据量 ≤ 2000 张/项目。典型流程：整理好图片文件夹 → 建项目 → 建类别并写提示词 → 导入 → 批量预标注 → 逐张审核并确认 → 导出训练集。服务只监听 `127.0.0.1`，无登录系统。

## 4. 架构

```
浏览器（React SPA，中文）
   │  /api/*：JSON / 图片 / 缩略图 / 导出下载
FastAPI 单进程 ── SQLite（WAL）+ data/ 文件目录
   └─ httpx ── OpenAI 兼容接口
```

- 单进程 FastAPI 同时提供 API、静态前端、文件服务；预标注任务用 asyncio 后台任务运行，任务状态持久化到 SQLite，前端每秒轮询进度。
- 数据存储：SQLite 保存项目、类别、图片、标注、任务、模型配置；图片保存在 `data/projects/{project_id}/images/`（复制模式）或原始路径（引用模式）；缩略图缓存到 `data/projects/{project_id}/thumbs/`。
- 不使用 Alembic；启动时 `create_all`。单机单用户，无并发写入冲突。
- 代码分后端 `backend/`、前端 `frontend/`，根目录 `scripts/` 提供启动脚本。

### 目录结构

```
LabelING/
  backend/
    app/
      main.py            # FastAPI 入口、静态托管、异常处理
      config.py          # 数据目录、端口等设置
      db.py              # engine/session/初始化
      models.py          # SQLModel 表
      schemas.py         # API 输入输出模型
      api/               # projects, classes, images, annotations, jobs, providers, export, fs
      services/          # 导入、缩略图、任务执行、导出、状态计算
      providers/         # base, openai_compat, mock, registry, prompt, parser
    tests/
    pyproject.toml
  frontend/
    src/
      pages/             # 项目列表、数据集、类别、标注台、导出、模型设置
      components/        # 通用组件、对话框、任务进度
      canvas/            # Konva 画布、框编辑、快捷键
      api/               # fetch 封装与类型
      stores/            # Zustand 编辑器状态
    package.json
  data/                  # 运行时数据，git 忽略
  docs/superpowers/specs/
  scripts/               # dev.ps1 / start.ps1
  README.md
```

### 技术栈

- 后端：Python 3.13、FastAPI、SQLModel、Pillow、httpx、uvicorn；`uv` 管理依赖。
- 前端：React 19 + TypeScript + Vite、React Router、TanStack Query、Zustand、react-konva + Konva、Tailwind CSS、Lucide 图标。
- 测试：pytest + FastAPI TestClient；Vitest + Testing Library。端到端以浏览器手工验证为主（不静默安装 Playwright）。

## 5. 数据模型

坐标统一存储为归一化浮点（0–1，左上角到右下角），与分辨率无关。

| 表 | 字段 |
|---|---|
| projects | id, name, description, model_config_id (nullable), created_at, updated_at |
| classes | id, project_id, name, color, prompt, order_index, created_at；`unique(project_id, name)` |
| images | id, project_id, storage_mode(`copy`/`reference`), stored_path, original_path, sha256, width, height, status, missing(bool), created_at, updated_at |
| annotations | id, image_id, class_id, x1, y1, x2, y2, source(`ai`/`human`), confidence(nullable), created_at, updated_at |
| prelabel_jobs | id, project_id, status, image_ids(JSON), class_ids(JSON nullable), total, processed, succeeded, failed, cancel_requested, error_summary, prompt_tokens, completion_tokens, created_at, started_at, finished_at |
| job_items | id, job_id, image_id, status, error_message, raw_excerpt, latency_ms |
| model_configs | id, name, provider_type, base_url, api_key, model_name, params(JSON), is_default, created_at, updated_at |

状态定义：
- `unlabeled` 未标注：没有任何标注框。
- `labeled` 待审核：有框但未确认。
- `confirmed` 已确认：用户显式确认。确认时所有 AI 框转为人工框（`source=human`）。
- 对已确认图片做任何标注修改，或对其运行预标注，自动退回 `labeled`。
- 已确认图片的「撤销确认」将其退回 `labeled`，框保留。
- 确认要求图片至少有一个框且文件存在；缺失图片不能确认。

类别删除：若已有标注引用该类别，返回 409，需显式 `force=true` 才连同框一起删除（界面二次确认）。

`model_configs.params` 字段：`concurrency`（默认 2）、`max_image_side`（默认 1280）、`temperature`（默认 0）、`timeout_s`（默认 120）、`max_tokens`（默认 2048）、`json_mode`（默认 false）、`extra_headers`、`extra_instructions`。

模型配置是全局的；项目通过 `model_config_id` 引用一套配置，在项目设置中选择。项目未选择模型时，预标注入口禁用并提示「请先在项目设置中选择模型」；仅 Mock 配置可供无 Key 演示。API Key 仅存服务端，查询接口只返回掩码（如 `sk-****abcd`）与 `has_api_key`，永不回传明文，不写入日志。

## 6. API 设计

统一前缀 `/api`；错误格式 `{"error":{"code":"...","message":"中文提示","details":...}}`；FastAPI 参数校验错误也转换为中文提示。

- 健康检查：`GET /health`。
- 项目：`GET/POST /projects`、`GET/PATCH/DELETE /projects/{id}`、`GET /projects/{id}/stats`。
- 类别：`GET/POST /projects/{id}/classes`、`PATCH/DELETE /classes/{id}`、`POST /projects/{id}/classes/reorder`。
- 图片：`GET /projects/{id}/images?status=&q=&page=&page_size=`、`GET /images/{id}`、`GET /images/{id}/file`、`GET /images/{id}/thumbnail`、`PATCH /images/{id}`（重新定位/移除标记）、`DELETE /images/{id}`。
- 导入：`GET /fs/list?path=`（目录浏览器，仅本机）、`POST /projects/{id}/import/preview`、`POST /projects/{id}/import`（`{folder_path, mode, recursive}`）。
- 标注：`GET /images/{id}/annotations`、`PUT /images/{id}/annotations`（整图全量替换）、`POST /images/{id}/confirm`、`POST /images/{id}/unconfirm`、`POST /projects/{id}/images/batch-confirm`、`POST /projects/{id}/images/batch-delete`。
- 预标注任务：`POST /projects/{id}/prelabel-jobs`（`image_ids` 必填，`class_ids` 可选）、`GET /projects/{id}/prelabel-jobs`、`GET /prelabel-jobs/{id}`、`POST /prelabel-jobs/{id}/cancel`。
- 模型配置：`GET/POST /model-configs`、`PATCH/DELETE /model-configs/{id}`、`POST /model-configs/{id}/test`、`POST /model-configs/test-draft`（保存前测试）。
- 导出：`GET /projects/{id}/export?format=yolo|coco&scope=annotated|confirmed&include_images=true|false`，直接返回 zip。

注解整图替换规则：请求携带每个框的 `id`（已有框）与 `source`。服务端对已有 AI 框，仅当几何与类别完全未变时保留 `ai`；被修改或新增的框一律记为 `human`。防止仅保存未修改的 AI 框就意外变成人工确认。图片存在框 → `labeled`；无框 → `unlabeled`；从 `confirmed` 变为任意修改 → `labeled`。

## 7. 预标注流水线

### 7.1 Provider 接口

```python
class PrelabelProvider(Protocol):
    async def detect(self, image: bytes, image_size: tuple[int, int],
                     classes: list[ClassSpec], config: ModelConfig) -> list[Detection]: ...
    async def test(self, config: ModelConfig) -> TestResult: ...
```

- `openai_compat`：POST `{base_url}/chat/completions`。若 base_url 以 `/chat/completions` 结尾则直接使用，否则拼接。请求含 system 提示、文本指令与 `data:image/jpeg;base64,...`；`Authorization: Bearer`，支持额外请求头；可选 `response_format={"type":"json_object"}`。
- `mock`：本地模拟，返回确定性框，供无 Key 开发、演示与自动化测试；界面明确标注「模拟（仅开发测试）」。
- 后续本地模型（Grounding DINO 等）只需新增实现并注册，不改任务层与前端。

### 7.2 提示词

系统提示：目标检测标注助手，只输出 JSON。用户消息包含类别列表（序号、名称、描述）与输出要求：

```
类别列表：
0. 名称：装甲板；描述：带 LED 灯条的机器人装甲板，通常为矩形，倾斜安装
1. 名称：能量机关；描述：...
要求：
1. 只检测以上类别，不要添加未列出的类别。
2. bbox 为相对坐标，取值 0–1000，格式 [x1,y1,x2,y2]，左上角到右下角。
3. 只标完整可见目标；置信度低于 0.2 的不输出。
4. 同一目标只输出一次。
5. 只输出 JSON：{"detections":[{"class_id":0,"bbox":[x1,y1,x2,y2],"confidence":0.9}]}
```

类别描述为空时回退使用类别名。请求前将图片按 `max_image_side` 等比缩放并转 JPEG（质量 85，RGB）；坐标始终相对整图，缩放不影响归一化结果。

### 7.3 响应解析容错

- 去除代码块围栏，提取首个 `{` 到末个 `}` 或裸 JSON 数组。
- 兼容键名：`detections`/`objects`/`boxes`/`results`；类别键 `class_id`/`category_id`/`class`/`label`（支持按名称匹配）；坐标键 `bbox`/`box`/`bbox_2d`/`coordinates`；置信度 `confidence`/`score`/`conf`。
- 坐标制式判断：全部 ≤ 1 视为 0–1；最大值 > 1000 视为原图像素；否则视为 0–1000 相对值。统一换算成归一化坐标。
- 修正 x1>x2 / y1>y2，裁剪到图像边界；丢弃退化框（宽或高小于 2px 等效值）；同类 IoU>0.9 去重保留高置信度；单图最多保留 500 个框。
- 解析失败的原始响应截断保存到 job_items.raw_excerpt（≤2KB）供排查。

### 7.4 任务执行

- 创建任务时校验图片与类别属于该项目，`image_ids` 非空。
- 后台 asyncio 任务，`asyncio.Semaphore(concurrency)` 控制并发；逐图调用 Provider。
- 重试：429、超时、5xx 最多重试 2 次（退避 1s、3s）；鉴权失败与参数错误不重试。
- 每张图成功：删除该图上「本次请求类别范围内」的旧 AI 框，写入新 AI 框；人工框不动。图片有框则置 `labeled`（从 confirmed 退回），无框置 `unlabeled`。
- 单图失败：记录 job_items 错误，继续后续图片；任务最终状态 `completed`（即使有失败）或 `failed`（无一张成功）。
- 取消：设置 `cancel_requested`，每张图开始前检查；已发出的请求等待返回或超时；任务状态 `cancelled`。
- 服务启动时把残留的 `queued`/`running` 任务标记为 `failed`，错误提示「服务重启，任务已中断」。
- 进度由前端每秒轮询；展示总数、已处理、成功、失败、当前耗时与 token 用量（若供应商返回）。
- 单图预标注也走任务机制，工作台显示进度后刷新标注。

### 7.5 连接测试

生成 512×384 的白底红矩形测试图，类别「红色矩形」，调用一次真实接口；返回是否成功、HTTP 状态、耗时、解析到的框数与响应摘要。能收到响应但解析不到框时提示「连接成功，但未解析到检测框」，不视为连接失败。

## 8. 审核工作台

布局（深色主题）：
- 顶部：返回、文件名、状态徽章、上一张/下一张、单图预标注、确认按钮。
- 左侧：缩略图竖向列表（虚拟滚动 + 懒加载），状态圆点，当前项高亮。
- 中部：Konva 画布，图片按容器等比适配，支持滚轮缩放、空格拖拽平移、适应窗口、1:1。
- 右侧：类别列表（颜色、快捷键序号、当前绘制类别）、当前图片的框列表（来源徽章、置信度、类别、删除）、提示词只读摘要。

交互：
- 工具：选择/移动/缩放（V）、画框（B）。画框使用当前类别，拖拽生成；选中框可拖动、通过锚点缩放、右侧下拉改类别。
- 已选类别快捷键 1–9；左右方向键切图；Delete 删除选中框；Ctrl+Z / Ctrl+Shift+Z 撤销/重做（会话内）；Ctrl+Enter 确认。
- AI 框：虚线边框 + AI 徽章 + 置信度；人工框：实线。移动/缩放/改类别 AI 框后自动转为人工框。
- 自动保存：每次修改后 400ms 防抖调用 `PUT /images/{id}/annotations`，顶部显示「保存中/已保存/保存失败」；失败可重试，不静默丢数据。
- 确认：把所有 AI 框转为人工框并置为 `confirmed`。批量接受在数据集页对选中图片执行同样操作，跳过缺失图片。
- 缺失文件：画布显示「文件缺失」提示，提供「重新定位」（选择新路径）与「移除记录」；缺失图片不参与预标注与确认。

数据集页：
- 状态统计卡片（未标注/待审核/已确认/缺失）。
- 筛选：状态、文件名搜索；分页（每页 60）。
- 批量操作：预标注选中图片（可选类别）、批量接受、撤销确认、删除。任务进度浮层可取消。
- 导入对话框：服务端目录浏览器、复制/引用、递归开关、预览数量与重复数、开始导入。

## 9. 导入与文件管理

- 支持 jpg/jpeg/png/bmp/webp；以 Pillow 校验可读性；拒绝 SVG。
- 扫描结果按 SHA-256 与项目内已有图片比对，重复默认跳过并在预览与结果中报告。
- 复制模式：存为 `data/projects/{id}/images/{uuid8}_{安全文件名}.{ext}`；引用模式：存绝对路径，原文件不移动、不修改。
- 宽高按 EXIF 方向修正后记录；缩略图生成时应用方向修正，320px WEBP 质量 80，按需生成并缓存。
- 缺失检测：打开图片、生成缩略图、预标注时若文件不存在则标记 `missing=true`；重新定位可恢复。
- 删除图片：复制模式删除项目内副本；引用模式只删记录不动原文件。删除项目：二次确认后删除数据库记录、复制副本与缩略图；引用原文件不动。
- 单次导入上限 5000 张；导入为同步请求，界面显示进行中状态。

## 10. 导出

- 格式：`yolo`、`coco`；范围：`annotated`（有框的图片，默认）、`confirmed`（仅已确认）；可选是否打包图片（默认包含）。
- 生成 zip 到 `data/exports/` 临时目录，`FileResponse` 返回后清理。
- 文件名冲突处理：导出时对重名图片加图片 id 短前缀，映射写入 `manifest.json`。
- 缺失文件跳过并记录在 manifest 的 `skipped_missing`；导出中文 `README.txt` 汇总项目名、格式、图片数、框数、类别映射、跳过项。
- YOLO：`images/`、`labels/`（同名 .txt，`class_id cx cy w h` 归一化 6 位小数）、`data.yaml`（`path: .`、`train: images`、`nc`、`names`）、`classes.txt`。无框图片不在 annotated 范围内。
- COCO：`annotations.json`（info、images、annotations、categories），bbox 为绝对像素 `[x,y,w,h]`，附带 `area` 与 `iscrowd: 0`；类别 id 按类别排序从 1 开始。
- 框坐标导出前裁剪到图像范围；面积为零或缺失的框跳过。

## 11. 安全与错误处理

- 仅监听 `127.0.0.1`；无登录。所有 JSON API 要求自定义请求头 `X-LabelING-Client: web`（图片/缩略图/下载除外），防止其他站点通过简单请求触发本地写操作；开发模式仅允许 `http://localhost:5173` 跨域。
- API Key 掩码返回、不写日志；存储于本机 SQLite（单机威胁模型下的取舍，后续可接系统密钥链）。
- 路径安全：图片/缩略图按记录 ID 访问；文件浏览接口仅用于本机导入；导出文件名做安全化处理。
- 错误分类与中文提示：鉴权失败、限流、超时、网络错误、响应解析失败、内容审核拒绝、文件缺失、磁盘写入失败。
- 全局异常处理统一错误结构；Provider 原始响应截断后仅存于任务详情，不进入普通日志。
- SQLite 开启 WAL 与外键；写入使用短事务。

## 12. 测试策略

- 后端单元测试：提示词构建、响应解析（多种 JSON/坐标制式/异常输入）、坐标换算、状态流转、导入扫描与去重、导出内容（解压校验 golden 结构）、base_url 规范化、路径安全。
- 后端集成测试：临时数据目录 + 临时 SQLite + Mock Provider，覆盖项目/类别/导入/标注全量替换/确认/任务/取消/导出；不调用真实 API。
- 前端单元测试：坐标与画布工具函数、编辑器 store 的撤销/重做、状态徽章与筛选逻辑。
- 手工/浏览器验收：核心闭环（建项目 → 类别 → 导入 → Mock 预标注 → 审核修改 → 批量接受 → 导出并解压核对）。
- 完成定义：`pytest` 全绿、`npm run build` 通过、核心闭环在浏览器实际操作通过、所有用户可见文案为中文。

## 13. 里程碑

1. **骨架**：后端 FastAPI + SQLite + 前端路由/布局/中文 UI + 项目与类别 CRUD。
2. **导入与网格**：目录浏览、复制/引用导入、缩略图、分页筛选、批量删除。
3. **标注台**：Konva 画布、框编辑、自动保存、撤销/重做、确认/撤销确认。
4. **预标注**：模型配置、OpenAI 兼容 Provider、Mock、连接测试、任务执行/进度/取消、重跑规则。
5. **审核与导出**：批量接受、状态统计、YOLO/COCO 导出、manifest。
6. **收尾**：错误处理、安全头、测试、启动脚本、README。

## 14. 风险与对策

- **VLM 出框精度与格式不稳定**：多重解析容错、类别描述写清楚、人工审核兜底；先以千问 VL 实测校准提示词。
- **DeepSeek 视觉/坐标能力不确定**：Provider 与模型解耦，任何 OpenAI 兼容视觉模型都能接；不把产品绑死。
- **批量预标注成本与限流**：并发可配（默认 2）、任务可取消、先小批量试跑、展示 token 用量；不自动重试鉴权错误。
- **2000 张缩略图性能**：分页网格 + 虚拟滚动侧栏 + 磁盘缓存。
- **数据丢失**：自动保存 + 明确保存状态 + SQLite WAL；删除操作均有确认，引用模式不动原图。
- **EXIF 方向与超大图**：记录修正后的宽高；发送模型前统一缩放转 JPEG。

## 15. 后续演进

本地开放词表检测 Provider（Grounding DINO / YOLO-World）、分割/关键点、局域网多人协作与账号、桌面安装包、数据集划分与版本、主动学习、与训练脚本联动。

## 16. 已确认关键决策

| 决策 | 结论 |
|---|---|
| 标注类型 | 仅矩形框 |
| 模型接入 | OpenAI 兼容国产视觉模型（千问/DeepSeek 等），可插拔 Provider |
| 形态 | 本地 Web 应用，FastAPI + React |
| 规模 | ≤ 2000 张/项目 |
| 调用策略 | 每图一次，全类别；支持按类别重跑 |
| 审核 | 未标注/待审核/已确认 + 批量接受 |
| 导入 | 复制与引用都支持 |
| 导出 | YOLO txt + COCO JSON |
| 访问 | 仅本机单用户 |
| 界面语言 | 全中文 |
| 坐标 | 归一化存储 |
| 存储 | SQLite + 项目文件目录 |
