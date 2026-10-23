# LabelING

本地运行的图像标注工具：导入未标注图片，用可配置的视觉模型做预标注，人工审核修正后导出 YOLO / COCO。界面全中文，数据和接口密钥都留在本机。

## 功能

- 项目管理、类别与提示词描述、类别排序
- 文件夹导入图片：复制到项目目录或引用原路径，支持递归扫描与去重
- 图片网格、状态筛选、批量接受、批量删除
- 标注工作台：Q 浏览 / W 框选双模式、悬停查看框信息、画框 / 移动 / 缩放 / 改类别 / 撤销重做 / 自动保存
- 三态审核：未标注 → 待审核 → 已确认
- Windows 系统托盘：打开界面、打开数据目录、彻底退出
- 模型预标注：OpenAI 兼容视觉接口（DeepSeek、千问、智谱等），每张图一次请求，全类别提示词
- 模型配置预设：内置 DeepSeek、阿里云百炼、智谱；通常只需粘贴接口密钥，接口地址和视觉模型自动填好
- 可从接口读取可用模型列表，并推荐视觉模型；仍支持任意 OpenAI 兼容接口
- 可插拔模型适配层；内置模拟模型，无需接口密钥即可体验完整流程
- Windows 桌面版：独立窗口（WebView2）、系统托盘、桌面快捷方式，不依赖浏览器
- 异步预标注任务：进度、取消、重试、逐图失败原因、token 用量
- 导出 YOLO txt（zip）与 COCO JSON（zip），含清单与中文说明
- 引用/复制两种图片模式，缺失文件检测与重新定位

## 环境要求

- 使用桌面安装版：Windows 10/11，无需安装 Python 或 Node.js；系统需要 Microsoft Edge WebView2 运行时（Windows 11 和大多数 Windows 10 已自带）
- 从源码运行或打包：Python 3.12+、[uv](https://docs.astral.sh/uv/)、Node.js 20+ 与 npm

## 快速开始（源码运行）

```powershell
# 1. 安装后端依赖（含桌面窗口依赖）
cd backend
uv sync --group desktop

# 2. 安装前端依赖
cd ..\frontend
npm install

# 3. 启动独立窗口（自动构建前端）
cd ..
powershell -ExecutionPolicy Bypass -File scripts/start.ps1
```

`start.ps1` 会构建前端、启动本地服务并打开 LabelING 独立窗口。关闭窗口（X）只会收起到系统托盘，右键托盘图标选择「彻底退出」才会关闭窗口并结束进程。

仍然可以只启动服务、用浏览器访问：

```powershell
cd backend
uv run python -m app.server
```

这种方式没有独立窗口和托盘，在启动服务的窗口按 `Ctrl+C` 停止。

开发模式（前端热更新，使用浏览器）：

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

## Windows 桌面版

桌面版是一个自带 Python 运行时、前端资源与 WebView2 窗口的可执行程序，界面运行在独立窗口中，不依赖外部浏览器，后台服务由系统托盘管理。

构建：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/build_desktop.ps1
```

构建结果：

```
dist/LabelING/LabelING.exe   # 双击即可启动
```

安装到本机并创建桌面 / 开始菜单快捷方式：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/install_desktop.ps1 -MigrateData
```

- `-MigrateData` 会在本机数据为空时，把仓库下的 `data/` 迁移到桌面版数据目录，适合首次切换。
- 程序安装目录：`%LOCALAPPDATA%\Programs\LabelING`
- 桌面版数据目录：`%LOCALAPPDATA%\LabelING`
- 日志：`%LOCALAPPDATA%\LabelING\logs\labeling.log`
- 点击快捷方式会启动服务、显示托盘图标并打开独立窗口；重复点击会把已运行的窗口带到前台。
- 关闭窗口（X）只会把窗口收起到系统托盘，服务继续运行；单击托盘图标或双击可重新打开窗口。
- 彻底退出：右键托盘图标，选择「彻底退出」。窗口会同时关闭，进程完全结束。
- 如果系统缺少 WebView2 运行时，程序启动时会给出提示，可从 <https://developer.microsoft.com/zh-cn/microsoft-edge/webview2/> 安装。

> 桌面版当前未做代码签名，Windows SmartScreen 可能提示「未知发布者」，选择「更多信息 → 仍要运行」即可。

## 首次使用流程

1. 新建项目。
2. 在「类别与提示词」添加类别，写清目标外观。例如：`装甲板`，提示词「机器人底盘上带发光灯条的矩形装甲板，可能倾斜安装」。
3. 在「数据集」导入图片文件夹。
4. 到「模型设置」新建模型配置：
   - 选择服务商（例如 DeepSeek），粘贴接口密钥即可；接口地址与默认视觉模型会自动填好。
   - 默认模型不可用时，点击「获取模型」从接口读取可用模型，系统会优先推荐视觉模型。
   - 没有接口密钥？选择「模拟模型」，可直接体验预标注、审核和导出。
   - 其他平台只要兼容 OpenAI Chat Completions 且支持图片输入，也可以选择「自定义接口」手动填写。
5. 在项目右上角「项目设置」中选择刚刚的模型配置。
6. 回到数据集，勾选图片运行预标注；或直接打开一张图片，在标注台点「预标注」。
7. 审核：模型预标框为虚线，可移动/缩放/改类别；确认后转为人工标注。
8. 到「导出」选择 YOLO 或 COCO，下载 zip。

## 启动与关闭

- **桌面窗口**：通过快捷方式、`LabelING.exe` 或 `scripts/start.ps1` 启动后，界面显示在独立窗口中。点击关闭按钮只会把窗口收起到托盘，服务继续运行。
- **Windows 托盘**：任务栏右下角会出现 LabelING 图标（Windows 11 可能收在托盘溢出菜单中）。单击或双击图标重新打开窗口；右键菜单可以打开界面、打开数据文件夹、查看运行状态，或选择「彻底退出」。
- **彻底退出**：右键托盘图标选择「彻底退出」，窗口和本地服务会一起关闭，进程完全结束。
- **命令行**：使用 `python -m app.server` 启动时没有托盘，在启动服务的窗口按 `Ctrl+C` 停止。

关闭服务会中断正在进行的预标注任务，建议先等待任务完成。

## 标注快捷键

| 按键 | 作用 |
| --- | --- |
| `Q` | 浏览模式，拖拽平移，悬停查看框的类别、来源、置信度和尺寸 |
| `W` | 框选模式，拖拽空白处画框，拖动已有框移动，用控制点缩放 |
| `1` – `9` | 切换当前类别 |
| `Delete` / `Backspace` | 删除选中的框 |
| `←` / `→` | 上一张 / 下一张图片 |
| `Esc` | 取消选中或当前绘制 |
| `空格 + 拖拽` | 在任意模式下平移画布 |
| 滚轮 | 以鼠标位置为中心缩放 |
| `Ctrl + Z` / `Ctrl + Shift + Z` / `Ctrl + Y` | 撤销 / 重做 |
| `Ctrl + S` | 立即保存 |
| `Ctrl + Enter` | 确认当前图片 |
| `?` | 打开快捷键说明 |

## 规则说明

- 坐标按归一化值存储，与图片分辨率无关。
- 重新运行预标注只替换模型框，人工框永久保留。
- 确认图片会把模型框转为人工框并标记为「已确认」；之后再修改会退回「待审核」。
- 删除类别时如已有标注，会二次确认并同时删除相关标注。
- 复制模式会复制一份图片到 `data/projects/{项目ID}/images/`；引用模式只记录原路径，原文件移动后会标记「文件缺失」。
- 接口密钥仅保存在本机 SQLite，接口返回掩码；日志与前端不会拿到明文。

## 数据与备份

- **源码模式**：数据目录为仓库下的 `data/`
- **桌面版**：数据目录为 `%LOCALAPPDATA%\LabelING`

目录结构相同：

```
labeling.db              # SQLite 数据库
projects/{id}/images/    # 复制模式的图片
projects/{id}/thumbs/    # 缩略图缓存
exports/                 # 导出临时目录
logs/                    # 桌面版运行日志
```

可通过环境变量 `LABELING_DATA_DIR` 指定其他目录。备份时复制整个数据目录即可；引用模式的原始图片需要单独备份。

## 测试

```powershell
cd backend
uv run pytest

cd ..\frontend
npm test
npm run build
npm run lint
```

桌面打包回归：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/build_desktop.ps1
```

## 版本发布（GitHub Releases）

仓库只提交源码；`dist/`、`build/`、`data/` 已被 `.gitignore` 排除。安装包请放到 GitHub Releases，不要提交进仓库。

首次上传：

```powershell
git remote add origin https://github.com/<用户名>/LabelING.git
git push -u origin main
```

每个版本单独打标签并推送：

```powershell
git tag -a v1.2.0 -m "LabelING v1.2.0"
git push origin v1.2.0
```

构建并发布安装包：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/build_desktop.ps1
New-Item -ItemType Directory -Force release | Out-Null
Compress-Archive -Path dist\LabelING -DestinationPath release\LabelING-v1.2.0-win-x64.zip
gh release create v1.2.0 release\LabelING-v1.2.0-win-x64.zip --title "LabelING v1.2.0" --notes "独立窗口与托盘退出改进"
```

`release/` 与 `dist/` 都不会进入 Git，安装包只作为 Release 附件上传。

不用命令行也可以在 GitHub 仓库的 Releases 页面点击「Draft a new release」，选择标签、填写说明并上传 zip。历史版本可以先在对应标签上构建，再分别创建 Release；当时未提供桌面构建的版本可以只保留源码标签。

## 已知限制

- 仅本机单用户，无登录体系；服务只监听 127.0.0.1。
- 桌面版仅提供 Windows 构建，依赖 Microsoft Edge WebView2 运行时；其他系统可从源码运行；未做代码签名。
- 仅矩形框目标检测，暂不支持分割、关键点、旋转框。
- 预标注质量取决于所选视觉模型的坐标输出能力，需要人工审核兜底。
- 单次导入最多 5000 张；建议单项目不超过约 2000 张。
- 不支持视频、多帧、团队协作与云端同步。

## 后续方向

本地开放词表检测模型（Grounding DINO / YOLO-World）、分割与关键点、局域网协作、数据集版本与划分。
