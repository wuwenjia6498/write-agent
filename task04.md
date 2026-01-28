# 任务：构建“老约翰”管理后台前端界面

## 1. 背景参考
核心 9 步工作流已跑通，现在需要基于 Next.js 15 构建用户操作界面。

## 2. 具体开发任务

### A. 品牌资产管理页 (/settings)
- 创建 Markdown 编辑器组件，支持对 `BrandAssets` 表中的个人简介、价值观、屏蔽词进行 CRUD 操作。
- 样式要求：简洁温润，符合儿童阅读推广机构的调性。

### B. 素材管理中心 (/materials)
- 实现素材上传表单：包含 Content (Text)、Channel (Select) 和 Tags。
- 实现素材列表展示，支持按频道筛选和关键词搜索。
- 集成向量化触发：确保新增素材时会调用后端的 embedding 接口。

### C. 任务历史详情页 (/tasks/[id])
- 按照 9 步 SOP 的顺序，可视化展示该任务的所有产出物。
- **核心组件**：实现一个 `DiffViewer`，用于对比 `draft_content` 和 `final_content`，直观展示审校效果。

## 3. 技术要求
- 使用 Tailwind CSS + Shadcn UI 组件库。
- 使用 `supabase-js` 进行数据读取和实时状态更新。