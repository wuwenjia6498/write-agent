# 角色与任务
你现在是老约翰自动化写作 AGENT 的核心后端开发工程师。请接管 `server/services/workflow_engine.py` 文件，对 `execute_step_7`（初稿创作）中的【样文原文驱动逻辑】进行“精准度增强”重构。

# 优化背景
目前的 Step 7 代码中，抽取样文使用的是 `random.sample`，且直接截取 `[:1000]`，并通过 Markdown 的 `###` 拼接到 Prompt 中。这种方式容易导致主题不匹配、缺少结尾学习，且容易让大模型产生边界幻觉从而抄袭样文内容。

# 核心重构需求
请修改 `workflow_engine.py` 中的 `execute_step_7` 方法，完成以下 3 项改造：

### 1. 废弃随机盲抽，引入轻量级文本相关性匹配
- 移除 `random.sample(all_samples, pick_count)`。
- 实现一个简单的轻量级评分逻辑：遍历 `all_samples`，根据 `selected_topic` 中的关键词在样文的 `title` 和 `content` 中出现的频率计算得分。
- 按得分降序排列，抽取 Top 2 样文。如果所有样文得分为 0，则回退到随机抽取。以保证抽取到的样文与当前选题更相关。

### 2. 实现“掐头取尾”黄金比例截取
- 废弃原有的 `content_preview = (s.get('content') or '')[:1000]`。
- 编写一个新的截取逻辑：如果样文内容超过 1000 字，请截取**前 700 字**和**最后 300 字**，中间用 `\n\n......[中间部分已省略，重点学习文章开头和结尾的升华语调]......\n\n` 进行连接。如果不足 1000 字则全量保留。

### 3. 引入 Claude 官方最佳实践：XML 边界隔离
- 重构 `sample_section` 的字符串拼接格式，完全使用 XML 标签包裹。
- 结构规范如下：
```xml
<style_reference_samples>
  <sample index="1">
    <title>《样文标题》</title>
    <content>这里是掐头取尾后的内容</content>
  </sample>
</style_reference_samples>

在 Step 7 的 system_prompt 或 user_message 的引导语中，明确增加以下严厉警告：
"请仔细分析 <style_reference_samples> 内的行文骨架、节奏和语气。绝对禁止照抄 <content> 中的任何具体事实、人名或案例。它们仅作为排版和语气的模具！"

执行要求
保持原有的五条最高军规和其他业务逻辑不变。

修改完毕后，请检查代码确保没有破坏现有的字典键值访问逻辑（注意检查 s.get('content') 的判空处理）。

请直接输出修改后的代码片段。