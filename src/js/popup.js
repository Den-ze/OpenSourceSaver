document.addEventListener('DOMContentLoaded', function() {
    const apiKeyInput = document.getElementById('apiKey');
    const saveButton = document.getElementById('saveButton');
    const resultDiv = document.getElementById('result');
    const testTitle = "索尼（SONY）Alpha 7 IV 全画幅微单相机 创意外观滤镜 单机身 五轴防抖 4K 60p（ILCE-7M4/A7M4）";
    const customUrlInput = document.getElementById('customUrl');
    const addUrlButton = document.getElementById('addUrlButton');
    const versionLink = document.getElementById('version-link');
    const manifest = chrome.runtime.getManifest();
    const version = manifest.version;

    if (versionLink) {
        versionLink.textContent += version;
    }

    // 定义 utils 对象
    const utils = {
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

    // 加载保存的 API Key
    chrome.storage.local.get(['smzdm_helper_api_key'], function(result) {
        if (result.smzdm_helper_api_key) {
            apiKeyInput.value = result.smzdm_helper_api_key;
        }
    });

    // 加载保存的自定义 URL
    chrome.storage.local.get(['customSmzdmUrl'], function(result) {
        if (result.customSmzdmUrl) {
            customUrlInput.value = result.customSmzdmUrl;
        }
    });

    // 保存 API Key 并测试
    saveButton.addEventListener('click', async () => {
        const apiKey = apiKeyInput.value.trim();
        if (!apiKey) {
            resultDiv.innerHTML = '<span class="error">API Key 不能为空</span>';
            return;
        }

        saveButton.disabled = true;
        resultDiv.innerHTML = '<div>正在保存并测试...</div>';

        try {
            // 保存 API Key
            await chrome.storage.local.set({ smzdm_helper_api_key: apiKey });

            // 测试 API
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
                                    "text": testTitle
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

            const result = data.choices[0].message.content.trim();
            resultDiv.innerHTML = `
                <div class="success">✓ API Key 已保存并测试成功！</div>
                <div style="margin-top: 10px;">
                    <strong>测试结果</strong><br>
                    原标题：${testTitle}<br>
                    简化为：${result}<br>
                    字符数：${result.length}
                </div>
            `;
        } catch (error) {
            resultDiv.innerHTML = `<span class="error">错误: ${error.message}</span>`;
        } finally {
            saveButton.disabled = false;
        }
    });

    addUrlButton.addEventListener('click', async () => {
        const customUrl = customUrlInput.value.trim();
        if (!customUrl) {
            resultDiv.innerHTML = '<span class="error">URL 不能为空</span>';
            return;
        }

        try {
            // 保存自定义 URL 到存储
            await chrome.storage.local.set({ customSmzdmUrl: customUrl });
            
            // 测试 URL
            const testKeyword = '索尼A7M4';
            const testUrl = customUrl.replace('testlink', encodeURIComponent(testKeyword));
            console.log('测试 URL:', testUrl);

            // 使用消息传递机制请求数据
            chrome.runtime.sendMessage(
                {
                    action: 'fetchSmzdm',
                    url: testUrl,
                    headers: {
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
                        'Cache-Control': 'no-cache',
                        'Pragma': 'no-cache',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                    }
                },
                response => {
                    console.log('响应:', response);
                    if (response && response.success) {
                        // 解析 HTML 并提取历史爆料
                        const parser = new DOMParser();
                        const doc = parser.parseFromString(response.data, 'text/html');
                        const result = doc.querySelector('.feed-row-wide'); // 假设历史爆料项的类名为 .feed-row-wide

                        let dealInfo = '未找到历史爆料';
                        if (result) {
                            const titleEl = result.querySelector('.feed-block-title');
                            const title = titleEl ? titleEl.textContent.trim() : '';
                            const truncatedTitle = title.length > 22 ? `${title.substring(0, 19)}...` : title;
                            const price = utils.extractPrice(title);
                            const worth = result.querySelector('.feed-btn-group')?.textContent?.trim();
                            const worthStats = utils.calculateWorthRate(worth || '0 +1 0 +1');
                            const articleLink = result.querySelector('.feed-block-title a')?.href || '';
                            const platform = result.querySelector('.feed-block-extras span')?.textContent?.trim() || '';
                            const timestamp = result.querySelector('.feed-block-extras')?.childNodes[0]?.textContent?.trim() || '';
                            const commentElement = result.querySelector('.feed-btn-comment');
                            const commentCount = commentElement ? commentElement.textContent.trim() : '0';
                            const favoriteElement = result.querySelector('.feed-btn-fav');
                            const favoriteCount = favoriteElement ? favoriteElement.textContent.trim() : '0';
                            dealInfo = `
                                <li style="margin-bottom: 10px; padding: 8px; border-bottom: 1px solid #eee; background: #f9f9f9; border-radius: 5px;">
                                    <div style="font-size: 14px; margin-bottom: 5px;">
                                        <a href="${articleLink}" target="_blank" style="text-decoration: none; color: #333;">
                                            ${truncatedTitle.replace(/\s\d+\.?\d*元/, '')}
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
                        }

                        resultDiv.innerHTML = `
                            <div class="success">✓ URL 已保存并测试成功！</div>
                            <div style="margin-top: 10px;">
                                <strong>历史爆料</strong><br>
                                <ul style="list-style: none; padding: 0;">${dealInfo}</ul>
                            </div>
                        `;
                    } else {
                        resultDiv.innerHTML = `<span class="error">错误: ${response ? response.error : '请求失败'}</span>`;
                    }
                }
            );
        } catch (error) {
            resultDiv.innerHTML = `<span class="error">错误: ${error.message}</span>`;
        }
    });
});
