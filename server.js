const puppeteer = require('puppeteer');
const express = require('express');

const app = express();

app.get('/', async (req, res) => {
    try {
        const browser = await puppeteer.launch({
            headless: true, // Run in headless mode
            args: ['--no-sandbox', '--disable-setuid-sandbox'] // Required for cloud environments
        });

        const page = await browser.newPage();

        // Step 1: Go to MedIndia hospitals directory page
        await page.goto('https://www.medindia.net/directories/hospitals/index.htm');

        // Step 2: Extract hospital profile links
        const hospitalLinks = await page.evaluate(() => {
            const elements = document.querySelectorAll('strip_box_wo_circle_desc');
            return Array.from(elements).map(el => el.href);
        });

        console.log(`Total links found: ${hospitalLinks.length}`);

        // Step 3: Process each hospital profile link
        const results = [];
        const keywords = ['neurology', 'neurologist', 'neurological'];

        for (let i = 0; i < hospitalLinks.length; i++) {
            const link = hospitalLinks[i];
            console.log(`Processing: ${link}`);

            try {
                // Visit the hospital profile page
                await page.goto(link, { waitUntil: 'domcontentloaded' });

                // Extract hospital name and location
                const hospitalData = await page.evaluate(() => {
                    const name = document.querySelector('h3 a')?.innerText || 'Unknown';
                    const location = document.querySelector('p')?.innerText || 'Unknown';
                    return { name, location };
                });

                // Find the hospital's official website link (if available)
                const officialWebsite = await page.evaluate(() => {
                    const websiteLink = document.querySelector('a[href^="http"]');
                    return websiteLink ? websiteLink.href : '';
                });

                // If a website exists, check it for relevant keywords
                if (officialWebsite) {
                    await page.goto(officialWebsite, { waitUntil: 'domcontentloaded' });

                    const pageText = await page.evaluate(() => document.body.innerText.toLowerCase());
                    if (keywords.some(keyword => pageText.includes(keyword))) {
                        results.push({
                            name: hospitalData.name,
                            location: hospitalData.location,
                            website: officialWebsite
                        });
                    }
                }
            } catch (error) {
                console.error(`Error processing link ${link}: ${error.message}`);
                continue; // Skip to the next link on failure
            }
        }

        await browser.close();

        // Step 4: Return results as JSON
        if (results.length > 0) {
            res.json({ success: true, results });
        } else {
            res.json({ success: false, message: 'No matching hospitals found.' });
        }
    } catch (error) {
        console.error('Error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
