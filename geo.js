var db = require('level')('/tmp/geo-db');
var geo = require('level-geospatial')(db);

geo.put({lat:52.081959, lon:1.415904}, 'Location1', 'My value', function(err){
	if (err) console.log(err);
});

db.createKeyStream().on('data', console.log);
