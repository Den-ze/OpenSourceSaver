document.addEventListener('DOMContentLoaded', function() {
    const apiKeyInput = document.getElementById('apiKey');
    const saveButton = document.getElementById('saveButton');
    const resultDiv = document.getElementById('result');
    const testTitle = "索尼（SONY）Alpha 7 IV 全画幅微单相机 创意外观滤镜 单机身 五轴防抖 4K 60p（ILCE-7M4/A7M4）";

    // 加载保存的 API Key
    chrome.storage.local.get(['smzdm_helper_api_key'], function(result) {
        if (result.smzdm_helper_api_key) {
            apiKeyInput.value = result.smzdm_helper_api_key;
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
});
