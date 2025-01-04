// Utility functions
const utils = {
    // Extract price from title
    extractPrice(title) {
        const priceMatch = title.match(/(\d+\.?\d*)元/);
        return priceMatch ? priceMatch[1] : '';
    },

    // Calculate worth rate from worth string
    calculateWorthRate(worth) {
        const worthMatches = worth.match(/(\d+)\s*\+1\s*(\d+)\s*\+1/);
        if (worthMatches) {
            const worthCount = parseInt(worthMatches[1]);
            const unworthCount = parseInt(worthMatches[2]);
            const total = worthCount + unworthCount;
            if (total > 0) {
                const rate = (worthCount / total * 100).toFixed(0);
                return {
                    worth: worthCount,
                    unworth: unworthCount,
                    rate: rate
                };
            }
        }
        return {
            worth: 0,
            unworth: 0,
            rate: 0
        };
    },

    // Get product title from page
    getProductTitle() {
        const titleElement = document.querySelector('.sku-name');
        return titleElement ? titleElement.innerText.trim() : '';
    }
};

// API related functions
const api = {
    // Simplify title using AI API
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
            console.error('AI API调用失败:', error);
            // 如果 AI 调用失败，返回截断的原标题
            return originalTitle.length > 18 ? originalTitle.substring(0, 18) : originalTitle;
        }
    },

    // Search SMZDM with fallback
    async searchSmzdm(keyword) {
        const url = `https://search.smzdm.com/?c=faxian&s=${encodeURIComponent(keyword)}&order=score&f_c=zhi&v=b`;
        
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
            
            // 验证返回的内容是否有效
            const errorElement = doc.querySelector('.error-notice');
            if (errorElement) {
                throw new Error('搜索结果不可用');
            }

            return doc;
        } catch (error) {
            console.error('SMZDM搜索失败:', error);
            throw new Error(`搜索失败: ${error.message}`);
        }
    }
};

// UI related functions
const ui = {
    createSidebar() {
        if (document.getElementById('smzdm-sidebar')) {
            return document.getElementById('smzdm-sidebar');
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

        // Add click event listener for search button
        const searchButton = sidebar.querySelector('#search-button');
        searchButton.addEventListener('click', () => {
            const keyword = sidebar.querySelector('#search-keyword').value.trim();
            if (keyword) {
                this.performSearch(keyword);
            }
        });

        return sidebar;
    },

    // Display search results
    displayResults(doc, originalUrl) {
        const content = document.querySelector('#smzdm-content');
        const moreLink = document.querySelector('#smzdm-more');
        if (moreLink) {
            moreLink.href = originalUrl;
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

    // Generate HTML for a single result
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

    // Show error message
    showError(message) {
        const content = document.querySelector('#smzdm-content');
        if (content) {
            content.innerHTML = `<div class="error" style="color: red; padding: 10px;">${message}</div>`;
        }
    },

    // Perform search with loading state
    async performSearch(keyword) {
        const content = document.querySelector('#smzdm-content');
        if (!content) return;

        content.innerHTML = '<div class="loading">正在搜索...</div>';
        try {
            const searchResults = await api.searchSmzdm(keyword);
            const searchUrl = `https://search.smzdm.com/?c=faxian&s=${encodeURIComponent(keyword)}&order=score&f_c=zhi&v=b`;
            this.displayResults(searchResults, searchUrl);
        } catch (error) {
            console.error('搜索失败:', error);
            this.showError(`${error.message} <br>您可以<a href="https://search.smzdm.com/?c=faxian&s=${encodeURIComponent(keyword)}&order=score&f_c=zhi&v=b" target="_blank">点击这里</a>直接访问什么值得买`);
        }
    }
};

// 主程序逻辑
async function init() {
    // 创建侧边栏
    ui.createSidebar();

    // 获取并处理商品标题
    const originalTitle = utils.getProductTitle(); // 从页面获取商品标题
    if (!originalTitle) {
        console.error('未找到商品标题'); // 如果未找到标题，输出错误信息
        return;
    }

    try {
        // 检查存储中是否存在 API Key
        const result = await chrome.storage.local.get(['smzdm_helper_api_key']);
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

        // 使用存储的 API Key 简化标题
        const simplifiedTitle = await api.simplifyTitle(originalTitle, apiKey); // 调用 API 进行标题简化
        console.log('原标题:', originalTitle);
        console.log('简化后的标题:', simplifiedTitle);
        
        // 将简化后的标题设置到输入框
        const searchInput = document.querySelector('#search-keyword');
        if (searchInput) {
            searchInput.value = simplifiedTitle;
            // 自动执行第一次搜索
            await ui.performSearch(simplifiedTitle);
        }
    } catch (error) {
        console.error('处理失败:', error);
        ui.showError(`处理失败：${error.message}`);
    }
}

// 当 DOM 准备好时初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
