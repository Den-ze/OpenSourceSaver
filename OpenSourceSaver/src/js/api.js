// API 相关函数
export const api = {
    // 使用 AI API 简化标题
    async simplifyTitle(originalTitle, apiKey) {
        try {
            const response = await fetch('https://api.siliconflow.cn/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`, // 使用用户提供的 API Key
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
                                    "text": originalTitle // 用户输入的原始标题
                                }
                            ]
                        }
                    ],
                    "temperature": 0.7
                })
            });

            const data = await response.json();
            if (data.error) {
                throw new Error(data.error.message || 'API 调用失败'); // 处理 API 错误
            }

            return data.choices[0].message.content.trim(); // 返回简化后的标题
        } catch (error) {
            console.error('AI API 调用失败:', error);
            // 如果调用失败，返回原始标题
            return originalTitle.length > 18 ? originalTitle.substring(0, 18) : originalTitle;
        }
    },

    // 搜索 SMZDM 的函数
    async searchSmzdm(keyword) {
        const url = `https://search.smzdm.com/?c=faxian&s=${encodeURIComponent(keyword)}&order=score&f_c=zhi`;
        
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

            return doc; // 返回解析后的文档
        } catch (error) {
            console.error('SMZDM 搜索失败:', error);
            throw new Error(`搜索失败: ${error.message}`);
        }
    }
};
