// 工具函数模块，用于从网页中提取所需信息
const utils = {
    // 设置商品标题
    setProductTitle(title) {
        title = title.trim();
        console.log('获取到的商品标题:', title);
        return title;
    },

    // 从smzdm的搜索结果中提取商品价格
    extractPrice(title) {
        const priceMatch = title.match(/(\d+\.?\d*)元/);
        return priceMatch ? priceMatch[1] : '';
    },

    // 计算值得买评价的值率
    calculateWorthRate(worth) {
        const worthMatches = worth.match(/(\d+)\s*\+1\s*(\d+)\s*\+1/);
        if (worthMatches) {
            const worthCount = parseInt(worthMatches[1]);
            const unworthCount = parseInt(worthMatches[2]);
            const total = worthCount + unworthCount;
            if (total > 0) {
                const rate = (worthCount / total * 100).toFixed(0);
                return { worth: worthCount, unworth: unworthCount, rate: rate };
            }
        }
        return { worth: 0, unworth: 0, rate: 0 };
    }
};

// API模块，负责与AI接口和SMZDM进行通信
const api = {
    // 使用AI接口简化商品标题
    async simplifyTitle(originalTitle, apiKey) {
        try {
            const response = await fetch('https://api.siliconflow.cn/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    "model": "Qwen/Qwen2.5-7B-Instruct",
                    "messages": [
                        {
                            "role": "system",
                            "content": [
                                {
                                    "type": "text",
                                    "text": "你是一个商品名称简化助手，请将复杂的商品名称简化为搜索关键词，只保留品牌和核心型号，不超过18个字符，字数限制尤为关键，请务必遵守。"
                                }
                            ]
                        },
                        {
                            "role": "user",
                            "content": [
                                {
                                    "type": "text",
                                    "text": originalTitle
                                }
                            ]
                        }
                    ],
                    "temperature": 0.7
                })
            });

            const data = await response.json();
            if (data.error) {
                throw new Error(data.error.message || 'API 调用失败');
            }
            return data.choices[0].message.content.trim();
        } catch (error) {
            console.error('AI API 调用失败:', error);
            return originalTitle.length > 18 ? originalTitle.substring(0, 18) : originalTitle;
        }
    },

    // 定义 SMZDM 搜索链接池
    smzdmUrls: [
        keyword => `https://search.smzdm.com/?c=faxian&s=${encodeURIComponent(keyword)}&order=score&f_c=zhi&v=b`,
        keyword => `https://search.smzdm.com/?c=faxian&s=${encodeURIComponent(keyword)}&order=score&f_c=zhi&mx_v=b`,
        keyword => `https://search.smzdm.com/?c=faxian&s=${encodeURIComponent(keyword)}`
    ],

    // 修改 searchSmzdm 函数以循环尝试不同的 URL
    async searchSmzdm(keyword) {
        for (let i = 0; i < this.smzdmUrls.length; i++) {
            const url = this.smzdmUrls[i](keyword);
            try {
                const response = await new Promise((resolve, reject) => {
                    chrome.runtime.sendMessage(
                        {
                            action: 'fetchSmzdm',
                            url: url,
                            headers: {
                                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                                'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
                                'Cache-Control': 'no-cache',
                                'Pragma': 'no-cache',
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                            }
                        },
                        response => {
                            if (response && response.success) {
                                resolve(response);
                            } else {
                                reject(new Error(response ? response.error : '请求失败'));
                            }
                        }
                    );
                });

                if (!response.success) {
                    throw new Error('搜索请求失败');
                }

                const parser = new DOMParser();
                const doc = parser.parseFromString(response.data, 'text/html');

                const errorElement = doc.querySelector('.error-notice');
                if (errorElement) {
                    throw new Error('搜索结果不可用');
                }

                return doc;
            } catch (error) {
                console.error(`SMZDM 搜索失败 (尝试第 ${i + 1} 个 URL):`, error);
                if (i === this.smzdmUrls.length - 1) {
                    throw new Error(`所有搜索链接均不可用: ${error.message}`);
                }
            }
        }
    }
};

// 用户界面模块
const ui = {
    // 创建并返回侧边栏
    createSidebar() {
        if (document.getElementById('smzdm-sidebar')) {
            return document.getElementById('smzdm-sidebar');
        }
    
        const sidebar = document.createElement('div');
        sidebar.id = 'smzdm-sidebar';
        sidebar.style.position = 'fixed'; // 改为固定定位

        // 从 localStorage 恢复位置
        const savedPosition = JSON.parse(localStorage.getItem('sidebarPosition'));
        if (savedPosition) {
            sidebar.style.left = savedPosition.left;
            sidebar.style.top = savedPosition.top;
        } else {
            sidebar.style.right = '0';
            sidebar.style.top = '20%';
        }

        sidebar.innerHTML = `
            <h3 style="margin-bottom: 15px; cursor: move;">
                什么值得买历史好价
                <a href="" id="smzdm-more" target="_blank" style="font-size: 12px; float: right; text-decoration: none; line-height: 1.5;">更多 ></a>
            </h3>
            <div style="margin-bottom: 15px; display: flex; gap: 10px;">
                <input type="text" id="search-keyword" style="flex: 1; padding: 5px; border: 1px solid #ddd; border-radius: 4px;" placeholder="搜索关键词">
                <button id="search-button" style="padding: 5px 15px; background: #2196f3; color: white; border: none; border-radius: 4px; cursor: pointer;">开源节流</button>
            </div>
            <div id="smzdm-content">
                <div class="loading">AI分析中...</div>
            </div>
        `;
        document.body.appendChild(sidebar);
    
        // 添加拖拽事件
        let isDragging = false;
        let offsetX, offsetY;
    
        sidebar.querySelector('h3').addEventListener('mousedown', (e) => {
            isDragging = true;
            offsetX = e.clientX - sidebar.offsetLeft;
            offsetY = e.clientY - sidebar.offsetTop;
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });
    
        function onMouseMove(e) {
            if (isDragging) {
                sidebar.style.left = `${e.clientX - offsetX}px`;
                sidebar.style.top = `${e.clientY - offsetY}px`;
            }
        }
    
        function onMouseUp() {
            isDragging = false;
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);

            // 保存位置到 localStorage
            localStorage.setItem('sidebarPosition', JSON.stringify({
                left: sidebar.style.left,
                top: sidebar.style.top
            }));
        }
    
        const searchButton = sidebar.querySelector('#search-button');
        searchButton.addEventListener('click', () => {
            const keyword = sidebar.querySelector('#search-keyword').value.trim();
            if (keyword) {
                this.performSearch(keyword);
            }
        });
    
        return sidebar;
    },

    // 展示搜索结果
    displayResults(doc, originalUrl) {
        const content = document.querySelector('#smzdm-content');
        const moreLink = document.querySelector('#smzdm-more');
        if (moreLink) moreLink.href = originalUrl;

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
                    const price = utils.extractPrice(title);
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
            html = '<div>未找到相关商品</div>';
        }

        content.innerHTML = html;
    },

    // 生成单个搜索结果的HTML结构
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
        `;
    },

    // 显示错误信息
    showError(message) {
        const content = document.querySelector('#smzdm-content');
        if (content) {
            content.innerHTML = `<div class="error" style="color: red; padding: 10px;">${message}</div>`;
        }
    },

    // 修改 performSearch 函数以使用新的 searchSmzdm 函数
    async performSearch(keyword) {
        const content = document.querySelector('#smzdm-content');
        if (!content) return;

        content.innerHTML = '<div class="loading">正在搜索...</div>';
        try {
            const searchResults = await api.searchSmzdm(keyword);
            const searchUrl = api.smzdmUrls[0](keyword); // 使用第一个 URL 作为原始链接
            ui.displayResults(searchResults, searchUrl);
        } catch (error) {
            console.error('搜索失败:', error);
            ui.showError(`${error.message} <br>您可以<a href="${api.smzdmUrls[0](keyword)}" target="_blank">点击这里</a>直接访问什么值得买`);
        }
    }
};

// 主程序逻辑，承担业务流程
async function init() {
    // 创建用户界面的侧边栏
    ui.createSidebar();

    // 添加 1 秒延迟，避免页面加载过快，导致无法获取到商品标题
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 获取当前页面的标题
    const originalTitle = utils.setProductTitle(document.title);
    if (!originalTitle) {
        console.error('未能获取商品标题');
        return;
    }

    // 从扩展程序的存储中获取 API Key
    chrome.storage.local.get(['smzdm_helper_api_key'], async function(result) {
        const apiKey = result.smzdm_helper_api_key;
        if (!apiKey) {
            ui.showError(`
                <div>
                    <p>请先设置 API Key</p>
                    <p>硅基流动免费 API 注册地址：<a href="https://cloud.siliconflow.cn/i/o6kZSNds" target="_blank">点击注册</a></p>
                    <p>注册后请点击扩展图标设置 API Key</p>
                </div>
            `);
            return;
        }

        try {
            // 使用 AI API 来简化商品标题
            const simplifiedTitle = await api.simplifyTitle(originalTitle, apiKey);
            console.log('原标题:', originalTitle);
            console.log('简化后的标题:', simplifiedTitle);
            
            // 将简化后的标题放入搜索框并自动搜索
            const searchInput = document.querySelector('#search-keyword');
            if (searchInput) {
                searchInput.value = simplifiedTitle;
                await ui.performSearch(simplifiedTitle);
            }
        } catch (error) {
            console.error('处理失败:', error);
            ui.showError(`处理失败：${error.message}`);
        }
    });
}

// 当 DOM 加载完成时，初始化程序
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
