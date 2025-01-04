import { utils } from './utils.js';

// 用户界面相关函数
export const ui = {
    // 创建侧边栏
    createSidebar() {
        if (document.getElementById('smzdm-sidebar')) {
            return document.getElementById('smzdm-sidebar'); // 如果侧边栏已存在，则返回
        }

        const sidebar = document.createElement('div');
        sidebar.id = 'smzdm-sidebar';
        sidebar.innerHTML = `
            <h3 style="margin-bottom: 15px;">
                什么值得买搜索结果
                <a href="" id="smzdm-more" target="_blank" style="font-size: 12px; float: right; text-decoration: none;">查看更多 ></a>
            </h3>
            <div style="margin-bottom: 15px; display: flex; gap: 10px;">
                <input type="text" id="search-keyword" style="flex: 1; padding: 5px; border: 1px solid #ddd; border-radius: 4px;" placeholder="搜索关键词">
                <button id="search-button" style="padding: 5px 15px; background: #2196f3; color: white; border: none; border-radius: 4px; cursor: pointer;">匹配</button>
            </div>
            <div id="smzdm-content">
                <div class="loading">正在加载...</div>
            </div>
        `;
        document.body.appendChild(sidebar);

        // 添加搜索按钮的点击事件监听
        const searchButton = sidebar.querySelector('#search-button');
        searchButton.addEventListener('click', () => {
            const keyword = sidebar.querySelector('#search-keyword').value.trim();
            if (keyword) {
                this.performSearch(keyword); // 执行搜索
            }
        });

        return sidebar; // 返回新创建的侧边栏
    },

    // 显示搜索结果
    displayResults(doc, originalUrl) {
        const content = document.querySelector('#smzdm-content');
        const moreLink = document.querySelector('#smzdm-more');
        if (moreLink) {
            moreLink.href = originalUrl; // 设置查看更多链接
        }

        const results = doc.querySelectorAll('.feed-row-wide');
        let html = '';

        if (results.length > 0) {
            html += '<ul style="list-style: none; padding: 0;">';
            results.forEach((result, index) => {
                if (index < 5) {
                    const titleEl = result.querySelector('.feed-block-title');
                    const title = titleEl ? titleEl.textContent.trim() : '';
                    const truncatedTitle = title.length > 22 ? `${title.substring(0, 19)}...` : title;
                    const worth = result.querySelector('.feed-btn-group')?.textContent?.trim();
                    const price = utils.extractPrice(title); // 提取价格
                    const worthStats = utils.calculateWorthRate(worth || '0 +1 0 +1');

                    const articleLink = result.querySelector('.feed-block-title a')?.href || '';
                    const platform = result.querySelector('.feed-block-extras span')?.textContent?.trim() || '';
                    const timestamp = result.querySelector('.feed-block-extras')?.childNodes[0]?.textContent?.trim() || '';

                    const commentElement = result.querySelector('.feed-btn-comment');
                    const commentCount = commentElement ? commentElement.textContent.trim() : '0';

                    const favoriteElement = result.querySelector('.feed-btn-fav');
                    const favoriteCount = favoriteElement ? favoriteElement.textContent.trim() : '0';

                    html += this.generateResultHTML(truncatedTitle, price, worthStats, articleLink, platform, timestamp, commentCount, favoriteCount);
                }
            });
            html += '</ul>';
        } else {
            html = '<div>未找到相关商品</div>'; // 如果没有找到商品
        }

        content.innerHTML = html; // 更新内容
    },

    // 生成单个结果的 HTML
    generateResultHTML(title, price, worthStats, link, platform, timestamp, commentCount, favoriteCount) {
        return `
            <li style="margin-bottom: 10px; padding: 8px; border-bottom: 1px solid #eee; background: #f9f9f9; border-radius: 5px;">
                <div style="font-size: 14px; margin-bottom: 5px;">
                    <a href="${link}" target="_blank" style="text-decoration: none; color: #333;">
                        ${title.replace(/\s\d+\.?\d*元/, '')}
                    </a>
                    <span style="float: right; color: #e4393c; font-weight: bold;">${price}元</span>
                </div>
                <div style="font-size: 11px; color: #888; display: flex; justify-content: space-between;">
                    <span style="background: #f0f0f0; padding: 1px 3px; border-radius: 3px;">值：${worthStats.worth}</span>
                    <span style="background: #f0f0f0; padding: 1px 3px; border-radius: 3px;">不值：${worthStats.unworth}</span>
                    <span style="background: ${worthStats.rate >= 60 ? '#e8f5e9' : '#fafafa'}; padding: 1px 3px;border-radius: 3px;">值率：${worthStats.rate}%</span>
                    <span>评：${commentCount}</span>
                    <span>藏：${favoriteCount}</span>
                    <span>${platform}</span>
                    <span>${timestamp}</span>
                </div>
            </li>
        `; // 返回生成的 HTML
    },

    // 显示错误信息
    showError(message) {
        const content = document.querySelector('#smzdm-content');
        if (content) {
            content.innerHTML = `<div class="error" style="color: red; padding: 10px;">${message}</div>`; // 显示错误信息
        }
    },

    // 执行搜索并显示加载状态
    async performSearch(keyword) {
        const content = document.querySelector('#smzdm-content');
        if (!content) return;

        content.innerHTML = '<div class="loading">正在搜索...</div>'; // 显示加载状态
        try {
            const searchResults = await api.searchSmzdm(keyword); // 调用 API 进行搜索
            const searchUrl = `https://search.smzdm.com/?c=faxian&s=${encodeURIComponent(keyword)}&order=score&f_c=zhi`;
            this.displayResults(searchResults, searchUrl); // 显示搜索结果
        } catch (error) {
            console.error('搜索失败:', error);
            this.showError(`${error.message} <br>您可以<a href="https://search.smzdm.com/?c=faxian&s=${encodeURIComponent(keyword)}&order=score&f_c=zhi" target="_blank">点击这里</a>直接访问什么值得买`);
        }
    }
};
