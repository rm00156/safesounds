const express =require("express");
const notProduction = process.env.NODE_ENV !== 'production';

if (notProduction) {
  require('dotenv').config(); // Load variables from .env file
}

const path = require('path');
const upload = require('express-fileupload');

const { normalizePort } = require("./helpers/generalHelper.js");
const indexRouter =require('./routes/index.js');

const port = normalizePort(process.env.PORT || '4000');
const app = express();


app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');
app.use(upload());

app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);

app.listen(port, () => {
  console.log(`Server running...`);
});


module.exports = app;