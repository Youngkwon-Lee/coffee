const fs = require('fs');

async function testOCR() {
    try {
        const filePath = 'C:\\Users\\82106\\.gemini\\antigravity\\brain\\dc497643-e1da-4900-8a03-ad83ca64de82\\mock_coffee_bag_1771763217917.png';
        const imageBuffer = fs.readFileSync(filePath);
        const blob = new Blob([imageBuffer], { type: 'image/png' });

        const formData = new FormData();
        formData.append('image', blob, 'mock_coffee_bag.png');
        formData.append('mode', 'coffee');

        console.log('Sending request to http://localhost:3000/api/glm-ocr...');

        const response = await fetch('http://localhost:3000/api/glm-ocr', {
            method: 'POST',
            body: formData,
        });

        const data = await response.json();
        console.log('Status Code:', response.status);
        console.log('\nResponse Data:\n', JSON.stringify(data, null, 2));

    } catch (error) {
        console.error('Test Failed:', error);
    }
}

testOCR();
