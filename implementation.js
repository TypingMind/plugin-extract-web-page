async function extract_info_from_web_page(params, userSettings) {
    const { url, question } = params;
    const { firecrawlAPIKey } = userSettings;
    
    if (!firecrawlAPIKey) {
        throw new Error("Firecrawl API Key is required. Please configure it in the plugin settings.");
    }
    
    if (!url || !question) {
        throw new Error("Both URL and question are required parameters.");
    }

    try {
        const extractResponse = await fetch('https://api.firecrawl.dev/v2/scrape', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${firecrawlAPIKey}`
            },
            body: JSON.stringify({
                url,
                formats: [{ type: 'json', prompt: question }],
                onlyMainContent: false,
                maxAge: 0,
                timeout: 300000
            })
        });

        if (!extractResponse.ok) {
            const errorData = await extractResponse.json().catch(() => ({}));
            throw new Error(`Extraction failed: ${extractResponse.status} - ${errorData.error || extractResponse.statusText}`);
        }

        const extractData = await extractResponse.json();
        
        if (extractData.success && extractData.data?.json != null) {
            return {
                success: true,
                data: extractData.data.json,
                warning: extractData.data.warning,
                message: "Information extracted successfully from the web page."
            };
        }
        
        throw new Error(`Extraction failed: ${extractData.data?.warning || 'No information was extracted from the web page.'}`);

    } catch (error) {
        // Handle network errors and other exceptions
        if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
            throw new Error('Network error occurred. Please check your internet connection and try again.');
        }
        
        // Re-throw the error with the original message
        throw new Error(error.message || 'An unexpected error occurred during extraction');
    }
}
