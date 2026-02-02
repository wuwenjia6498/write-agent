任务：设计并初始化“老约翰自动化写作AGENT”核心数据库 Schema
1. 任务背景
我们需要将原本基于本地文件夹（_briefs, _个人素材库 等）的静态存储结构，升级为支持多用户、多频道的动态数据库架构。

2. 数据库表结构设计要求
请使用 SQL (PostgreSQL 兼容) 或 SQLAlchemy 定义以下核心表：

A. channels (内容频道表)
用于管理“深度阅读”、“绘本”、“育儿”等频道配置：

id: 唯一标识 (UUID)

name: 频道名称 (如：深度阅读)

description: 读者画像与核心目标定义

system_prompt: 该频道的专用 AI 写作指令

style_guide_refs: 关联的样文路径或 ID

B. brand_assets (品牌全局资产表)
存储品牌灵魂资料，采用 Key-Value 结构以便扩展：

asset_key: 标识符 (如：personal_intro, blocking_words, core_values)

content: 具体的文本内容（Markdown 格式）

last_updated: 最后更新时间

C. personal_materials (个人素材库 - 核心 RAG 表)
存储 15 年来的“人味碎片”，需支持向量检索：

id: 唯一标识

content: 原始素材文本 (如：揉馒头感悟)

channel_id: 归属频道（外键，支持多选或全频道通用）

material_type: 类型（金句/案例/反馈/感悟）

embedding: 向量字段 (使用 pgvector 存储 1536 维向量)

tags: 关键词标签 (JSONB 格式)

D. writing_tasks (写作任务流表)
记录 9 步 SOP 的全过程状态：

id: 任务唯一 ID

channel_id: 所选频道

current_step: 当前步骤 (1-9 整数)

status: 状态 (如：processing, waiting_confirm, completed)

brief_data: 需求简报内容 (JSON)

knowledge_base_data: 调研结果 (TEXT/JSON)

draft_content: S7 生成的初稿

final_content: S8 审校后的成稿

think_aloud_logs: 存储 AI 的思考过程记录

3. 开发约束
数据隔离：确保在检索素材时，必须带上 channel_id 过滤，严禁跨频道污染。

审校逻辑预留：brand_assets 表中的 blocking_words 必须能在 S8 步骤被快速索引并作为字符串过滤依据。

扩展性：表结构需支持未来通过界面直接新增频道（配置化）。

4. 下一步行动
请先输出你的 Think Aloud，展示你设计的 ER 图（实体关系图）逻辑，说明各表之间如何协同完成一次完整的 9 步写作任务。