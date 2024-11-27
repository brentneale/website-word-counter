const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const { URL } = require('url');

const app = express();
app.use(cors());
app.use(express.json());

const isProductOrCollectionPage = (urlString) => {
    const url = new URL(urlString);
    const pathParts = url.pathname.toLowerCase().split('/').filter(part => part);
    
    // Check if it's a collection or product page
    return (pathParts.includes('collections') && !pathParts.includes('products')) || 
           pathParts.includes('products');
};

const analyzeWebsite = async (baseUrl, productPagesOnly) => {
    console.log('Starting analysis for:', baseUrl);
    const visited = new Set();
    const toVisit = [baseUrl];
    const parsedBase = new URL(baseUrl);
    const baseHostname = parsedBase.hostname;
    let wordFrequency = new Map();
    let pagesAnalyzed = 0;

    while (toVisit.length > 0) {
        const currentUrl = toVisit.pop();
        
        if (visited.has(currentUrl)) {
            continue;
        }

        visited.add(currentUrl);

        try {
            console.log('Fetching:', currentUrl);
            const response = await axios.get(currentUrl, {
                validateStatus: status => status >= 200 && status < 300,
                timeout: 30000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
            });

            const $ = cheerio.load(response.data);
            
            // Only analyze if it's not product-only mode OR if it is a product/collection page
            if (!productPagesOnly || isProductOrCollectionPage(currentUrl)) {
                $('script').remove();
                $('style').remove();
                $('nav').remove();
                $('header').remove();
                $('footer').remove();
                $('[style*="display: none"]').remove();
                $('[style*="display:none"]').remove();
                
                const text = $('body').text();
                const words = text.toLowerCase()
                    .replace(/[^a-z0-9\s]/g, ' ')
                    .split(/\s+/)
                    .filter(word => word.length > 1);
                
                words.forEach(word => {
                    wordFrequency.set(word, (wordFrequency.get(word) || 0) + 1);
                });
                
                pagesAnalyzed++;
                console.log(`Analyzed page ${pagesAnalyzed}: ${currentUrl}`);
            }

            // Find all links
            $('a').each((_, element) => {
                let href = $(element).attr('href');
                if (!href) return;
                
                try {
                    const absoluteUrl = new URL(href, currentUrl);
                    const cleanUrl = absoluteUrl.toString().split('#')[0];

                    // Check if it's an internal link we haven't visited
                    if (absoluteUrl.hostname === baseHostname && 
                        !visited.has(cleanUrl) && 
                        !toVisit.includes(cleanUrl)) {
                        
                        // If in product-only mode, only add product/collection pages
                        if (!productPagesOnly || isProductOrCollectionPage(cleanUrl)) {
                            toVisit.push(cleanUrl);
                            console.log(`Added to queue: ${cleanUrl}`);
                        }
                    }
                } catch (e) {
                    // Skip invalid URLs
                    console.error(`Invalid URL found: ${href}`);
                }
            });

        } catch (error) {
            console.error(`Error processing ${currentUrl}:`, error.message);
            continue;
        }
    }

    console.log(`Analysis complete. Analyzed ${pagesAnalyzed} pages`);
    return {
        pagesAnalyzed,
        wordFrequency: Object.fromEntries(wordFrequency)
    };
};

// Keep existing endpoints the same
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
        res.status(500).json({ error: 'Failed to analyze website' });
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