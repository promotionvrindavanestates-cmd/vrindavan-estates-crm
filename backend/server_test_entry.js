const DB = require('./db.js');
DB.isCloud = () => false;
require('./server.js');
