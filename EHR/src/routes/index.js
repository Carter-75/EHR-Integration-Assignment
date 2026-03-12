var express = require('express');
var path = require('path');
var router = express.Router();

/* GET home page — serve SPA */
router.get('/', function (req, res, next) {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

module.exports = router;
