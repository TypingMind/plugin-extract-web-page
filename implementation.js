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
        // Step 1: Send extract request to Firecrawl
        const extractResponse = await fetch('https://api.firecrawl.dev/v1/extract', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${firecrawlAPIKey}`
            },
            body: JSON.stringify({
                urls: [url],
                prompt: question
            })
        });

        if (!extractResponse.ok) {
            const errorData = await extractResponse.json().catch(() => ({}));
            throw new Error(`Failed to start extraction: ${extractResponse.status} - ${errorData.error || extractResponse.statusText}`);
        }

        const extractData = await extractResponse.json();
        
        // If the extraction completed immediately (synchronous response)
        if (extractData.success && extractData.data && !extractData.id) {
            return {
                success: true,
                data: extractData.data,
                message: "Information extracted successfully from the web page."
            };
        }
        
        // Step 2: Get the extract job ID for polling
        const jobId = extractData.id;
        if (!jobId) {
            throw new Error("No job ID received from Firecrawl extract API");
        }

        // Step 3: Poll for results every 1 second
        let attempts = 0;
        const maxAttempts = 300; // 5 minutes maximum wait time
        const pollInterval = 1000; // 1 second

        while (attempts < maxAttempts) {
            // Wait 1 second before polling
            await new Promise(resolve => setTimeout(resolve, pollInterval));
            attempts++;

            // Check extraction status
            const statusResponse = await fetch(`https://api.firecrawl.dev/v1/extract/${jobId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${firecrawlAPIKey}`
                }
            });

            if (!statusResponse.ok) {
                const errorData = await statusResponse.json().catch(() => ({}));
                throw new Error(`Failed to check extraction status: ${statusResponse.status} - ${errorData.error || statusResponse.statusText}`);
            }

            const statusData = await statusResponse.json();

            // Check if extraction is completed
            if (statusData.status === 'completed' && statusData.success) {
                return {
                    success: true,
                    data: statusData.data,
                    message: `Information extracted successfully from the web page after ${attempts} seconds.`,
                    extractionTime: attempts
                };
            }

            // Check if extraction failed
            if (statusData.status === 'failed' || (statusData.status === 'completed' && !statusData.success)) {
                throw new Error(`Extraction failed: ${statusData.error || 'Unknown error occurred during extraction'}`);
            }

            // Check if extraction was cancelled
            if (statusData.status === 'cancelled') {
                throw new Error('Extraction was cancelled');
            }

            // Continue polling if status is 'processing' or 'pending'
            if (statusData.status === 'processing' || statusData.status === 'pending') {
                // Continue polling
                continue;
            }
        }

        // If we've reached max attempts without completion
        throw new Error(`Extraction timed out after ${maxAttempts} seconds. The job may still be processing - please try again later.`);

    } catch (error) {
        // Handle network errors and other exceptions
        if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
            throw new Error('Network error occurred. Please check your internet connection and try again.');
        }
        
        // Re-throw the error with the original message
        throw new Error(error.message || 'An unexpected error occurred during extraction');
    }
}
