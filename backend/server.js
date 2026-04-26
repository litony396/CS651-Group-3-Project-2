const express = require('express');

const app = express();

const diagnoseRoute = require('./routes/diagnoseRoute.js')

// setup app for routing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// route to diagnosis
app.use('/api/diagnose', diagnoseRoute);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
})

