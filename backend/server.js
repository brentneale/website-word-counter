const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const { URL } = require('url');

const app = express();
app.use(cors({
    origin: ['https://website-word-counter.vercel.app', 'http://localhost:3000'],
    credentials: true
}));
app.use(express.json());

const PAGE_LIMIT = 1000;
const TIMEOUT = 60000; // Increased timeout to 60 seconds

const isProductOrCollectionPage = (urlString) => {
    try {
        const url = new URL(urlString);
        const pathParts = url.pathname.toLowerCase().split('/').filter(part => part);
        return (pathParts.includes('collections') && !pathParts.includes('products')) || 
               pathParts.includes('products');
    } catch (e) {
        console.error('Error checking URL:', urlString, e.message);
        return false;
    }
};

const analyzeWebsite = async (baseUrl, productPagesOnly) => {
    console.log('Starting analysis for:', baseUrl);
    const visited = new Set();
    const toVisit = [baseUrl];
    const parsedBase = new URL(baseUrl);
    const baseHostname = parsedBase.hostname;
    let wordFrequency = new Map();
    let pagesAnalyzed = 0;
    let totalPagesChecked = 0;
    let errors = 0;

    while (toVisit.length > 0 && totalPagesChecked < PAGE_LIMIT && errors < 50) {
        const currentUrl = toVisit.pop();
        totalPagesChecked++;
        
        if (visited.has(currentUrl)) {
            continue;
        }

        visited.add(currentUrl);

        try {
            console.log(`Fetching (${totalPagesChecked}/${PAGE_LIMIT}):`, currentUrl);
            const response = await axios.get(currentUrl, {
                validateStatus: status => status >= 200 && status < 300,
                timeout: TIMEOUT,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                },
                maxRedirects: 5
            });

            const $ = cheerio.load(response.data);
            
            if (!productPagesOnly || isProductOrCollectionPage(currentUrl)) {
                // Remove unwanted elements
                $('script').remove();
                $('style').remove();
                $('nav').remove();
                $('header').remove();
                $('footer').remove();
                $('noscript').remove();
                $('[style*="display: none"]').remove();
                $('[style*="display:none"]').remove();
                $('[style*="visibility: hidden"]').remove();
                
                const text = $('body').text();
                const words = text.toLowerCase()
                    .replace(/[^a-z0-9\s]/g, ' ')
                    .split(/\s+/)
                    .filter(word => word.length > 1 && word.length < 30); // Filter out very long strings
                
                if (words.length > 0) {
                    words.forEach(word => {
                        wordFrequency.set(word, (wordFrequency.get(word) || 0) + 1);
                    });
                    pagesAnalyzed++;
                    console.log(`Successfully analyzed page ${pagesAnalyzed}: ${currentUrl}`);
                }
            }

            if (totalPagesChecked < PAGE_LIMIT) {
                $('a').each((_, element) => {
                    let href = $(element).attr('href');
                    if (!href) return;
                    
                    try {
                        const absoluteUrl = new URL(href, currentUrl);
                        const cleanUrl = absoluteUrl.toString().split('#')[0];

                        if (absoluteUrl.hostname === baseHostname && 
                            !visited.has(cleanUrl) && 
                            !toVisit.includes(cleanUrl)) {
                            
                            if (!productPagesOnly || isProductOrCollectionPage(cleanUrl)) {
                                toVisit.push(cleanUrl);
                            }
                        }
                    } catch (e) {
                        // Skip invalid URLs
                    }
                });
            }

        } catch (error) {
            errors++;
            console.error(`Error processing ${currentUrl}:`, error.message);
            continue;
        }
    }

    if (pagesAnalyzed === 0) {
        throw new Error('No pages could be analyzed. Please check the URL and try again.');
    }

    console.log(`Analysis complete. Analyzed ${pagesAnalyzed} pages out of ${totalPagesChecked} checked`);
    return {
        pagesAnalyzed,
        wordFrequency: Object.fromEntries(wordFrequency)
    };
};

app.post('/analyze-words', async (req, res) => {
    try {
        const { url, productPagesOnly } = req.body;
        console.log('Starting analysis with URL:', url, 'Product pages only:', productPagesOnly);
        
        try {
            new URL(url);
        } catch (e) {
            return res.status(400).json({ error: 'Invalid URL provided' });
        }

        const result = await analyzeWebsite(url, productPagesOnly);
        res.json(result);
    } catch (error) {
        console.error('Analysis error:', error);
        res.status(500).json({ error: error.message || 'Failed to analyze website' });
    }
});

app.post('/generate-csv', (req, res) => {
    try {
        const { wordFrequency } = req.body;
        
        const sortedWords = Object.entries(wordFrequency)
            .sort((a, b) => b[1] - a[1]);

        let csvContent = 'Word,Frequency\n';
        sortedWords.forEach(([word, count]) => {
            csvContent += `"${word}",${count}\n`;
        });

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=word-frequency.csv');
        res.send(csvContent);
    } catch (error) {
        console.error('CSV generation error:', error);
        res.status(500).json({ error: 'Failed to generate CSV file' });
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});