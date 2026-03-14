var createError = require('http-errors');
var express = require('express');
var logger = require('morgan');
var cors = require('cors');

var indexRouter = require('./routes/index');
var medicationRouter = require('./routes/medication');
var dataRouter = require('./routes/data');

var app = express();

app.use(cors());
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use('/', indexRouter);
app.use('/', medicationRouter);
app.use('/', dataRouter);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler — returns JSON for SPA
app.use(function (err, req, res, next) {
  res.status(err.status || 500).json({
    message: err.message,
    error: req.app.get('env') === 'development' ? err : {}
  });
});

module.exports = app;
