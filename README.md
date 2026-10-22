# LabelING

本地运行的图像标注工具：导入未标注图片，用可配置的视觉模型做预标注，人工审核修正后导出 YOLO / COCO。界面全中文，数据和 API Key 都留在本机。

## 功能

- 项目管理、类别与提示词描述、类别排序
- 文件夹导入图片：复制到项目目录或引用原路径，支持递归扫描与去重
- 图片网格、状态筛选、批量接受、批量删除
- 标注工作台：画框 / 移动 / 缩放 / 改类别 / 撤销重做 / 自动保存 / 快捷键
- 三态审核：未标注 → 待审核 → 已确认
- 模型预标注：OpenAI 兼容视觉接口（千问、DeepSeek 等），每张图一次请求，全类别提示词
- 可插拔 Provider；内置模拟模型，无需 API Key 即可体验完整流程
- 异步预标注任务：进度、取消、重试、逐图失败原因、token 用量
- 导出 YOLO txt（zip）与 COCO JSON（zip），含清单与中文说明
- 引用/复制两种图片模式，缺失文件检测与重新定位

## 环境要求

- Windows 10/11（其他系统也可运行，启动脚本目前提供 PowerShell）
- Python 3.12+ 与 [uv](https://docs.astral.sh/uv/)
- Node.js 20+ 与 npm

## 快速开始

```powershell
# 1. 安装后端依赖
cd backend
uv sync

# 2. 构建前端
cd ..\frontend
npm install
npm run build

# 3. 启动服务
cd ..\backend
uv run uvicorn app.main:app --host 127.0.0.1 --port 8000
```

打开 <http://127.0.0.1:8000>。

也可以直接运行：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/start.ps1
```

开发模式（前端热更新）：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/dev.ps1
```

后端 8000 端口，前端 5173 端口。

生成演示图片：

```powershell
cd backend
uv run python ..\scripts\make_demo_images.py
```

然后导入 `data/demo_images`。

## 首次使用流程

1. 新建项目。
2. 在「类别与提示词」添加类别，写清目标外观。例如：`装甲板`，提示词「机器人底盘上带 LED 灯条的矩形装甲板，可能倾斜安装」。
3. 在「数据集」导入图片文件夹。
4. 到「模型设置」新建模型配置：
   - 没有 API Key？选择「模拟模型」，可直接体验预标注、审核和导出。
   - 使用千问：接口类型选 OpenAI 兼容，Base URL 填 `https://dashscope.aliyuncs.com/compatible-mode/v1`，模型名称按平台文档填写（如 `qwen-vl-max`），再填 API Key。
   - 其他平台只要兼容 OpenAI Chat Completions 且支持图片输入即可。
5. 在项目右上角「项目设置」中选择刚刚的模型配置。
6. 回到数据集，勾选图片运行预标注；或直接打开一张图片，在标注台点「预标注」。
7. 审核：AI 框为虚线，可移动/缩放/改类别；确认后转为人工标注。
8. 到「导出」选择 YOLO 或 COCO，下载 zip。

## 规则说明

- 坐标按归一化值存储，与图片分辨率无关。
- 重新运行预标注只替换 AI 框，人工框永久保留。
- 确认图片会把 AI 框转为人工框并标记为「已确认」；之后再修改会退回「待审核」。
- 删除类别时如已有标注，会二次确认并同时删除相关标注。
- 复制模式会复制一份图片到 `data/projects/{项目ID}/images/`；引用模式只记录原路径，原文件移动后会标记「文件缺失」。
- API Key 仅保存在本机 SQLite，接口返回掩码；日志与前端不会拿到明文。

## 数据与备份

默认数据目录为仓库下的 `data/`：

```
data/
  labeling.db              # SQLite 数据库
  projects/{id}/images/    # 复制模式的图片
  projects/{id}/thumbs/    # 缩略图缓存
  exports/                 # 导出临时目录
```

可通过环境变量 `LABELING_DATA_DIR` 指定其他目录。备份时整个 `data/` 目录一起复制即可；引用模式的原始图片需要单独备份。

## 测试

```powershell
cd backend
uv run pytest

cd ..\frontend
npm test
npm run build
```

## 已知限制

- 仅本机单用户，无登录体系；服务只监听 127.0.0.1。
- 仅矩形框目标检测，暂不支持分割、关键点、旋转框。
- 预标注质量取决于所选视觉模型的坐标输出能力，需要人工审核兜底。
- 单次导入最多 5000 张；建议单项目不超过约 2000 张。
- 不支持视频、多帧、团队协作与云端同步。

## 后续方向

本地开放词表检测模型（Grounding DINO / YOLO-World）、分割与关键点、局域网协作、数据集版本与划分、桌面安装包。
