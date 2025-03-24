import axios from 'axios';
import fs from 'fs';

const API_URL = 'http://35.200.185.69:8000/v1/autocomplete?query=';
const CHARS = 'abcdefghijklmnopqrstuvwxyz';
const DELAY = 500; // Delay between requests (ms)
const RETRY_DELAY = 5000; // Wait time when rate limited (5s)
const MAX_QUEUE_SIZE = 1000; // Prevent queue overflow

let visitedQueries = new Set();
let validQueries = new Set(); // Track valid prefixes to expand
let rateLimitedQueries = new Set(); // Track queries that hit 429 errors

const writeStream = fs.createWriteStream('results.json', { flags: 'a' });

async function fetchNames(query) {
    if (visitedQueries.has(query) || rateLimitedQueries.has(query)) return;
    visitedQueries.add(query);

    const endpoint = API_URL + encodeURIComponent(query);
    try {
        const { data } = await axios.get(endpoint);
        if (data && Array.isArray(data.results) && data.results.length > 0) {
            data.results.forEach(name => {
                writeStream.write(JSON.stringify(name) + '\n'); // Stream to file
                if (name.startsWith(query)) validQueries.add(name);
            });

            // Expand further if 10 results (API may have more)
            if (data.results.length === 10) {
                CHARS.split('').forEach(char => {
                    let newQuery = query + char;
                    if (!visitedQueries.has(newQuery)) 
                        validQueries.add(newQuery);
                });
            }
        }
        console.log(`"${query}" → ${data.results.length} results`);
    } catch (err) {
        if (err.response?.status === 429) {
            console.warn(`Rate limit hit! Retrying "${query}" in ${RETRY_DELAY / 1000} sec`);
            rateLimitedQueries.add(query);
            await new Promise(res => setTimeout(res, RETRY_DELAY));
            rateLimitedQueries.delete(query); // Retry after delay
            await fetchNames(query); // Retry the request
            return;
        }
        console.error(`Error for "${query}":`, err.message);
    }
    await new Promise(res => setTimeout(res, DELAY)); // Rate limit handling
}

async function exploreAPI() {
    let queue = [...CHARS]; // Start with single letters

    while (queue.length > 0) {
        let query = queue.shift();
        await fetchNames(query);

        // Expand only discovered prefixes from API response
        validQueries.forEach(validPrefix => {
            if (!visitedQueries.has(validPrefix) && !rateLimitedQueries.has(validPrefix)) {
                if (queue.length < MAX_QUEUE_SIZE) {
                    queue.push(validPrefix);
                }
            }
        });

        validQueries.clear(); // Free memory
    }

    writeStream.end(); // Close the file stream
    console.log('API exploration complete! Results saved.');
}

exploreAPI();
