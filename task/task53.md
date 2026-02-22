# Role
资深后端架构师

# Task
清理全局约束配置文件，并将“禁用书目”的拦截防线彻底前置（Shift Left）到创作阶段，同时重构审校环节的质检逻辑，杜绝硬编码和文章逻辑断裂。

# Step 1: 全局配置文件清理 (`server/configs/global/writing_constraints.json`)
1. 打开该 JSON 文件。
2. **彻底删除**整个 `"style_dna"` 节点（包含 `pass_threshold` 和 `description`）。
3. **保留** `banned_books`、`word_count`、`sentence`、`paragraph` 等其他有效约束节点。

# Step 2: 消除硬编码排查 (`server/services/workflow_engine.py`)
1. 全局排查 `workflow_engine.py` 的相关代码。
2. 如果存在任何硬编码的具体书名列表（如定义了包含《夏洛的网》等书名的数组），**立即删除**。

# Step 3: 拦截防线前置 (Step 4 & Step 7)
1. 在 `execute_step_4` (生成协作文档) 和 `execute_step_7` (生成初稿) 的逻辑中，动态读取 `writing_constraints.json` 中的 `banned_books.list`。
2. 将以下极其严厉的指令注入到 Step 4 和 Step 7 的 System Prompt 中：
   "【最高红线】：在构思案例和撰写文章时，**绝对禁止**引用以下过度泛滥的童书作为案例：{banned_books_list}。你必须优先使用 Step 2 检索到的知识库中的具体教案书目！如果违反此红线，你的输出将被直接废弃。"

# Step 4: 审校逻辑重构，弱化手术属性 (Step 8)
1. 在 `execute_step_8` 的第二遍（知识准确性核对）Prompt 组装中，确保读取前端传入的【频道配置】（严格禁止规则和屏蔽词），以及 JSON 中的 `banned_books.list`。
2. 将第二遍的校验 Prompt 修改为单纯的双重质检指令，**切勿要求大段重写替换**：
   "请严格核对文章内容及推荐的书目，执行以下双重检查：
   1. 【频道专属底线】：是否违反了该频道的【严格禁止】规则，或包含了该频道的【屏蔽词汇】。绝不要推荐超出该频道受众认知阶段的书籍。
   2. 【全局反偷懒原则】：检查文章是否违规使用了以下书目：{global_banned_books_list}。
   如果发现了这些【全局反偷懒】书目，说明初稿严重违规。请在审校报告中进行【标红警告】，并尝试在不破坏原段落逻辑结构的前提下，用最简单的泛指词（如：'某些经典长篇童书'）抹去该书名。为了防止上下文逻辑断裂，不允许在此时强行替换为其他具体书名或做大段重写。"