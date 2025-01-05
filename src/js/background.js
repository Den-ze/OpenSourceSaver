// 监听来自内容脚本的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'fetchSmzdm') {
        // 发送请求获取 SMZDM 数据
        fetch(request.url, {
            method: 'GET',
            headers: request.headers || {
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        })
        .then(response => response.text())
        .then(data => {
            // 成功获取数据，发送响应
            sendResponse({ success: true, data: data });
        })
        .catch(error => {
            console.error('后台获取错误:', error);
            // 发送错误响应
            sendResponse({ success: false, error: error.message });
        });

        return true; // 保持消息通道以便异步响应
    }
});

