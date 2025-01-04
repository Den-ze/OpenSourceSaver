// 工具函数，用于数据处理和计算
export const utils = {
    // 从标题中提取价格
    extractPrice(title) {
        const priceMatch = title.match(/(\d+\.?\d*)元/);
        return priceMatch ? priceMatch[1] : ''; // 返回匹配到的价格，若无则返回空字符串
    },

    // 从价值字符串计算价值率
    calculateWorthRate(worth) {
        const worthMatches = worth.match(/(\d+)\s*\+1\s*(\d+)\s*\+1/);
        if (worthMatches) {
            const worthCount = parseInt(worthMatches[1]); // 可值计数
            const unworthCount = parseInt(worthMatches[2]); // 不值计数
            const total = worthCount + unworthCount; // 总计数
            if (total > 0) {
                const rate = (worthCount / total * 100).toFixed(0); // 计算价值率并四舍五入
                return {
                    worth: worthCount,
                    unworth: unworthCount,
                    rate: rate // 返回可值、不值和价值率
                };
            }
        }
        return {
            worth: 0,
            unworth: 0,
            rate: 0 // 默认返回0值
        };
    },

    // 从不同购物网站获取商品标题
    getProductTitle() {
        const hostname = window.location.hostname; // 获取当前主机名
        let title = '';

        // 仅支持京东和京东国际的标题选择器配置
        const selectors = {
            'item.jd.com': ['.sku-name'], // 京东商品标题选择器
            'npcitem.jd.hk': ['.sku-name']  // 京东国际商品标题选择器
        };

        // 获取当前网站的选择器
        const currentSelectors = selectors[hostname];
        
        if (currentSelectors) {
            // 尝试所有可能的选择器
            for (const selector of currentSelectors) {
                const element = document.querySelector(selector);
                if (element) {
                    title = element.innerText.trim(); // 获取标题文本并去除空白
                    if (title) break; // 找到标题后退出循环
                }
            }
        }

        console.log('获取到的商品标题:', title); // 调试日志，输出获取到的标题
        return title; // 返回获取到的标题
    },

    // 快捷键处理函数
    setupShortcuts() {
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            if (request.command === "toggle_search") {
                const title = this.getProductTitle(); // 获取当前商品标题
                if (title) {
                    // 触发搜索事件
                    document.dispatchEvent(new CustomEvent('triggerSearch', { detail: { title } }));
                }
            }
        });
    }
};

// 初始化快捷键
utils.setupShortcuts();
