import axios from 'axios';

async function fetchNames(query) {
    try {
        const API_URL = `http://35.200.185.69:8000/v1/autocomplete?query=${query}`;
        const response = await axios.get(API_URL);
        if (response.data) {
            console.log('Response:', response.data);
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

fetchNames('a');




