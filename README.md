# BibleFlow — 多版本圣经阅读器

一个面向 **桌面与移动端** 的多版本圣经阅读器，支持多译本对照、音频朗读、逐词高亮与全文搜索。

A multi‑version Bible reader for **desktop and mobile**, built around the **Chinese Studium Biblicum (zh_sigao)** as primary, with parallel version comparison, audio playback with word‑level highlighting, and full‑text search.

---

## ✨ 功能特点 / Features

### 📖 多译本对照

- 主要译本 + 次要译本并排显示，主次可自由切换
- **拖拽排序**：版本面板支持拖拽，排第一位自动成为主要译本
- 两区域互拖：**已启用** ↔ **未启用**，至少保留一个已启用译本
- 所有启用的译本都按同一书卷、同一章节对齐显示

### 🔊 音频朗读 + 逐词高亮

- 播放音频时，当前单词逐词高亮(目前该功能仅支持 NRSVCE 版本)
- **音频版本可独立选择**，不强制与主要译本一致
- 即使音频译本不在主要位置，也能正确高亮对应经文

### 🔍 全文搜索

- 基于预构建索引的毫秒级全文搜索
- 支持所有已启用译本同时搜索
- 搜索结果按译本显示，书卷名称跟随主要译本

### ⌨️ 桌面键盘快捷键

| 按键 | 功能 |
|---|---|
| `Space` | 播放 / 暂停 |
| `←` | 快退 15 秒 |
| `→` | 快进 15 秒 |

### 📱 移动端友好

- 自适应布局，手机 / 平板 / 桌面一致体验
- 侧拉面板支持触摸拖拽排序
- 大按钮触控操作，适合朗读与翻阅

---

## 🌐 支持的译本 / Supported Versions

| 译本 | 类型 | 音频 | 逐字高亮 |
|---|---|---|---|
| **思高（zh_sigao）** | 天主教中文 | 否 | 否 |
| **NRSVCE（en_nrsvce）** | 天主教英文 | ✅ | ✅ |
| 和合本（zh_cuv2010） | 新教中文 | 否 | 否 |
| KJV（en_kjv） | 新教英文 | 否 | 否 |

> 默认：**思高** 为主要译本，**NRSVCE** 为次要译本。音频默认播放 NRSVCE。

---

## 🏗️ 架构说明 / Architecture

### 译本对齐策略

- 以 **天主教 book_id 1-73** 为内部唯一主键
- 新教译本通过 `prot_id` 字段映射到天主教 ID
- Deutero 次经书卷（多俾亚传、友弟德传等）在新教译本中显示为 "—"
- 章节差异：章节数不同的书卷（如艾斯德尔传/以斯帖记），多出的章自动显示 "—"

### 技术栈

- **纯静态站点**：HTML + CSS + Vanilla JS，无框架依赖
- **IIFE 模块化**：10 个 JS 模块通过 `window.BibleFlow` 命名空间组织
- **数据源**：经文 JSON 与搜索索引托管于阿里云 OSS
- **部署**：GitHub Pages（静态托管）

### 模块结构

```
static/js/
├── config.js      → 静态配置（译本列表、OSS 地址）
├── state          → 运行时状态（当前书卷、章节、译本）
├── utils.js       → 工具函数（URL 构建、译本判断、prot_id 映射）
├── entity.js      → 实体样式（人名、地名、神名高亮）
├── highlight.js   → 音频逐词高亮
├── verse.js       → 经文加载与多版本渲染
├── book.js        → 书卷面板、章节导航、分类分组
├── chapter.js     → 章节选择面板
├── player.js      → 音频播放器
├── search.js      → 全文搜索（索引 + 实时回退）
└── main.js        → 入口、侧拉面板、版本拖拽排序
```

### 本地测试工作流

```
1. 本地测试数据放 oss/ 目录（模拟远程 OSS 结构）
2. 本地 HTTP 服务器验证效果（localhost:8080）
3. 满意后上传数据到阿里云 OSS
4. 推送代码到 GitHub（oss/ 不推送，已加 .gitignore）
```

---

## 🚀 在线预览 / Live Demo

👉 https://clare7am.github.io/bibleflow/

---

## 🛠️ 开发 / Development

```bash
# 本地启动 HTTP 服务器
python -m http.server 8080
```

---

> ⚠️ **版权声明 / Copyright Notice**
>
> 本仓库保留所有权利。
> 未授予任何形式的使用、复制、修改、分发或引用许可。
> 代码仅作信息展示、信仰学习之用，不构成任何授权。
>
> © 2026 Clare
