// Required modules
const express = require('express');
const axios = require('axios');
const path = require('path');
const bodyParser = require('body-parser');
const fs = require('fs');
const mongoose = require('mongoose'); // Add Mongoose

const app = express();

// Connect to MongoDB
mongoose.connect('mongodb://127.0.0.1:27017/imageSearchDB', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', () => {
    console.log('Connected to MongoDB');
});

// Define Mongoose Schema
const searchHistorySchema = new mongoose.Schema({
    input: String,
    imageUrl: String,
    createdAt: { type: Date, default: Date.now },
});

const SearchHistory = mongoose.model('SearchHistory', searchHistorySchema);


const { v4: uuidv4 } = require('uuid');

// Set EJS as the templating engine
app.set('view engine', 'ejs');

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Parse URL-encoded bodies from POST requests
app.use(bodyParser.urlencoded({ extended: true }));

// Render the index page
app.get('/', (req, res) => {
    res.render('index');
});

// Handle form submission to generate the image
app.post('/image', async (req, res) => {
    const input = req.body.name;

    // Function to query Hugging Face API
    async function query(data) {
        const token = "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"; 
        try {
            const response = await axios.post(
                "https://api-inference.huggingface.co/models/ZB-Tech/Text-to-Image",
                { inputs: data },
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "Content-Type": "application/json",
                    },
                    responseType: 'arraybuffer', // Handle binary data (image)
                }
            );
    
            // Generate a unique filename
            const filename = `generated_image_${uuidv4()}.png`;
            const imagePath = path.join(__dirname, 'public', filename);
    
            // Save the binary image data to the unique file
            fs.writeFileSync(imagePath, response.data);
    
            return filename; // Return the unique filename
        } catch (error) {
            console.error('Error fetching the image:');
            throw error;
        }
    }
    

    try {
        const imageUrl = await query(input); // Get the image URL
        res.render('result', { imageUrl: imageUrl, input });

        // Save search history to MongoDB
        const historyEntry = new SearchHistory({ input, imageUrl });
        await historyEntry.save();

        // Render the result page and pass the image URL
       

    } catch (error) {
        res.status(500).send('Error generating image.');
    }
});

// Display search history
app.get('/history', async (req, res) => {
    try {
        const history = await SearchHistory.find().sort({ createdAt: -1 }); // Get all history entries
        res.render('history', { history }); // Render history page
    } catch (error) {
        res.status(500).send('Error fetching history.');
    }
});

// Delete a history entry
app.post('/history/delete/:id', async (req, res) => {
    const { id } = req.params;

    try {
        // Find the record
        const record = await SearchHistory.findById(id);

        if (record) {
            // Delete the image file
            const imagePath = path.join(__dirname, 'public', record.imageUrl);
            if (fs.existsSync(imagePath)) {
                fs.unlinkSync(imagePath);
            }

            // Delete the database record
            await SearchHistory.findByIdAndDelete(id);
        }

        res.redirect('/history');
    } catch (error) {
        res.status(500).send('Error deleting history.');
    }
});


// Start the server
app.listen(3000, () => {
    console.log('Server is running on http://localhost:3000');
});
