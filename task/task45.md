# Role
资深全栈工程师

# Task
执行“素材库并入知识库”的最后一步：清理前端冗余的旧“素材管理”页面及导航入口。

# Logic Requirements (代码减法)
1. **清理导航栏**：找到全局顶部导航栏组件（可能是 `components/Header.tsx`, `components/Navbar.tsx` 或 `app/layout.tsx`），删除指向【素材管理】(`href="/materials"` 或类似路径) 的导航链接 (Link)。
2. **删除前端页面**：直接删除整个旧的素材管理页面文件夹（通常在 `app/admin/materials` 或 `app/materials` 下的 `page.tsx` 及其相关组件）。
3. **清理后端路由 (可选但建议)**：如果后端有专门针对旧素材库的路由文件（如 `server/routes/materials.py`），将其删除，并在 `main.py` 中移除该路由的注册代码。