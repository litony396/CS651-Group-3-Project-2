const express = require('express');
const path = require('path');
const app = express();

const diagnoseRoute = require('./routes/diagnoseRoute.js')

// setup app for routing
// while debugging, Gemini said to add larger request size limits since we are sending media
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// route to diagnosis
app.use('/api/diagnose', diagnoseRoute);

// two lines below are used to
// Serve the static React files
app.use(express.static(path.join(__dirname, 'public')));

// Catch-all route: send any unknown requests to the React app
app.use((req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
})

