-- ==============================================================================
-- 老约翰自动化写作AGENT - 数据库 Schema (PostgreSQL + pgvector)
-- 
-- 创建顺序：
-- 1. 启用 pgvector 扩展
-- 2. 创建表
-- 3. 创建索引
-- ==============================================================================

-- 启用 pgvector 扩展（需要超级用户权限，Supabase 默认已启用）
CREATE EXTENSION IF NOT EXISTS vector;

-- ==============================================================================
-- A. channels (内容频道表)
-- 用于管理"深度阅读"、"绘本"、"育儿"等频道配置
-- ==============================================================================
CREATE TABLE IF NOT EXISTS channels (
    -- 主键：UUID 类型
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- 频道基本信息
    name VARCHAR(100) NOT NULL UNIQUE,
    slug VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    
    -- AI 写作配置 (JSONB 支持复杂结构)
    system_prompt JSONB,
    
    -- 样文参考 (JSONB 数组)
    style_guide_refs JSONB DEFAULT '[]'::jsonb,
    
    -- 频道特定规则
    channel_rules JSONB,
    
    -- 状态与时间戳
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- slug 索引（用于 URL 查询）
CREATE INDEX IF NOT EXISTS ix_channels_slug ON channels(slug);

-- 添加注释
COMMENT ON TABLE channels IS '内容频道表 - 管理深度阅读、绘本、育儿等频道配置';
COMMENT ON COLUMN channels.slug IS '频道标识符，用于 URL，如：deep_reading';
COMMENT ON COLUMN channels.system_prompt IS '频道专用 AI 写作指令，包含 role、writing_style、tone_guidelines 等';


-- ==============================================================================
-- B. brand_assets (品牌全局资产表)
-- 存储品牌灵魂资料，采用 Key-Value 结构以便扩展
-- ==============================================================================
CREATE TABLE IF NOT EXISTS brand_assets (
    -- 主键：使用 asset_key 作为主键，便于直接查询
    asset_key VARCHAR(100) PRIMARY KEY,
    
    -- 资产内容
    content TEXT NOT NULL,
    
    -- 内容类型
    content_type VARCHAR(20) DEFAULT 'markdown',
    
    -- 资产描述
    description VARCHAR(500),
    
    -- 时间戳
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 添加注释
COMMENT ON TABLE brand_assets IS '品牌全局资产表 - 存储品牌灵魂资料（Key-Value 结构）';
COMMENT ON COLUMN brand_assets.asset_key IS '资产标识符，如：personal_intro, blocking_words, core_values';
COMMENT ON COLUMN brand_assets.content IS '具体的文本内容，支持 Markdown 格式';


-- ==============================================================================
-- C. personal_materials (个人素材库 - 核心 RAG 表)
-- 存储 15 年来的"人味碎片"，支持向量检索
-- ==============================================================================
CREATE TABLE IF NOT EXISTS personal_materials (
    -- 主键
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- 素材内容
    content TEXT NOT NULL,
    
    -- 所属频道 (外键，NULL 表示全频道通用)
    channel_id UUID REFERENCES channels(id) ON DELETE SET NULL,
    
    -- 素材类型
    material_type VARCHAR(20) NOT NULL DEFAULT '其他',
    
    -- 向量嵌入字段 (pgvector，1536 维度 - 兼容 OpenAI embeddings)
    embedding vector(1536),
    
    -- 标签 (JSONB 数组)
    tags JSONB DEFAULT '[]'::jsonb,
    
    -- 素材来源
    source VARCHAR(200),
    
    -- 时间戳
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 频道索引
CREATE INDEX IF NOT EXISTS ix_materials_channel_id ON personal_materials(channel_id);

-- 复合索引：channel_id + material_type
CREATE INDEX IF NOT EXISTS ix_materials_channel_type ON personal_materials(channel_id, material_type);

-- 向量索引 (ivfflat - 适合中等规模数据，需要先有数据才能创建)
-- 注意：建议在有一定数据量后执行此语句
-- CREATE INDEX IF NOT EXISTS ix_materials_embedding 
--     ON personal_materials 
--     USING ivfflat (embedding vector_cosine_ops)
--     WITH (lists = 100);

-- 添加注释
COMMENT ON TABLE personal_materials IS '个人素材库表 - 存储15年来的人味碎片，支持向量语义检索';
COMMENT ON COLUMN personal_materials.channel_id IS '归属频道ID，NULL 表示全频道通用';
COMMENT ON COLUMN personal_materials.embedding IS '语义向量，用于相似度检索（1536维，兼容 OpenAI embeddings）';
COMMENT ON COLUMN personal_materials.material_type IS '素材类型：金句/案例/反馈/感悟/其他';


-- ==============================================================================
-- D. writing_tasks (写作任务流表)
-- 记录 9 步 SOP 的全过程状态
-- ==============================================================================
CREATE TABLE IF NOT EXISTS writing_tasks (
    -- 主键
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- 所属频道 (外键)
    channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    
    -- 任务标题
    title VARCHAR(200),
    
    -- 当前步骤 (1-9)
    current_step INTEGER NOT NULL DEFAULT 1 CHECK (current_step >= 1 AND current_step <= 9),
    
    -- 任务状态
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
    
    -- S1: 需求简报数据 (JSONB)
    brief_data JSONB DEFAULT '{}'::jsonb,
    
    -- S2: 调研结果
    knowledge_base_data TEXT,
    
    -- S7: 初稿内容
    draft_content TEXT,
    
    -- S8: 审校后的最终稿
    final_content TEXT,
    
    -- AI 思考过程记录 (Think Aloud)
    think_aloud_logs JSONB DEFAULT '[]'::jsonb,
    
    -- 时间戳
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

-- 频道索引
CREATE INDEX IF NOT EXISTS ix_tasks_channel_id ON writing_tasks(channel_id);

-- 状态索引
CREATE INDEX IF NOT EXISTS ix_tasks_status ON writing_tasks(status);

-- 复合索引：channel_id + status
CREATE INDEX IF NOT EXISTS ix_tasks_channel_status ON writing_tasks(channel_id, status);

-- 复合索引：channel_id + current_step
CREATE INDEX IF NOT EXISTS ix_tasks_channel_step ON writing_tasks(channel_id, current_step);

-- 添加注释
COMMENT ON TABLE writing_tasks IS '写作任务流表 - 记录9步SOP的全过程状态';
COMMENT ON COLUMN writing_tasks.current_step IS '当前所在步骤，1-9 对应 S1-S9';
COMMENT ON COLUMN writing_tasks.status IS '任务状态：draft/processing/waiting_confirm/completed/cancelled';
COMMENT ON COLUMN writing_tasks.brief_data IS '需求简报及各步骤扩展数据';
COMMENT ON COLUMN writing_tasks.think_aloud_logs IS 'AI 思考过程记录，数组格式存储每步的思考日志';


-- ==============================================================================
-- 触发器：自动更新 updated_at 字段
-- ==============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- channels 表触发器
DROP TRIGGER IF EXISTS update_channels_updated_at ON channels;
CREATE TRIGGER update_channels_updated_at
    BEFORE UPDATE ON channels
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- personal_materials 表触发器
DROP TRIGGER IF EXISTS update_materials_updated_at ON personal_materials;
CREATE TRIGGER update_materials_updated_at
    BEFORE UPDATE ON personal_materials
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- writing_tasks 表触发器
DROP TRIGGER IF EXISTS update_tasks_updated_at ON writing_tasks;
CREATE TRIGGER update_tasks_updated_at
    BEFORE UPDATE ON writing_tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


-- ==============================================================================
-- 权限设置 (Supabase Row Level Security)
-- 如果使用 Supabase，取消注释以下内容
-- ==============================================================================
-- ALTER TABLE channels ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE brand_assets ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE personal_materials ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE writing_tasks ENABLE ROW LEVEL SECURITY;

-- 创建允许所有操作的策略（开发环境）
-- CREATE POLICY "Allow all" ON channels FOR ALL USING (true);
-- CREATE POLICY "Allow all" ON brand_assets FOR ALL USING (true);
-- CREATE POLICY "Allow all" ON personal_materials FOR ALL USING (true);
-- CREATE POLICY "Allow all" ON writing_tasks FOR ALL USING (true);

