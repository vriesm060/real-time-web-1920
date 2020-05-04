require('dotenv').config({ path: './vars.env' });

var express = require('express');
var app = express();
var path = require('path');
var server = require('http').createServer(app);
var io = require('socket.io')(server);
var session = require('express-session')({
  secret: process.env.SESSION_SECRET || 'my-secret',
  resave: true,
  saveUninitialized: true
});
var sharedsession = require('express-socket.io-session');
var bodyParser = require('body-parser');
var {Client, Status} = require('@googlemaps/google-maps-services-js');
var uuid = require('short-uuid');
var MongoClient = require('mongodb').MongoClient;
var uri = 'mongodb+srv://max:' + process.env.MONGO_PW + '@trippiecluster-qqgdb.mongodb.net/test?retryWrites=true&w=majority';
var client = new MongoClient(uri, { useNewUrlParser: true }, { useUnifiedTopology: true });

app.use(session);
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');

// Create a users list for all active users:
var activeUsers = [];
var cachePaths = [];

io.use(sharedsession(session, { autoSave: true }));

app.get('/', function (req, res) {
  io.once('connection', (socket) => {
    socket.emit('id', socket.handshake.session.id);
  });

  res.render('index');
});

app.post('/trip', function (req, res) {
  // Create trip object:
  var trip = {
    id: uuid.generate(),
    name: {
      value: req.body.trip.replace(/\s+/g, '-').replace('/', '-').toLowerCase(),
      literal: req.body.trip
    },
    location: {
      value: req.body.location.replace(/\s+/g, '-').replace('/', '-').toLowerCase(),
      literal: req.body.location
    },
    path: [],
    admins: [
      {
        id: req.body.socketId,
        username: req.body.username,
        admin: true,
        root: true
      }
    ]
  };

  client.connect(err => {
    if (err) throw err;
    var db = client.db('trippie');
    db.collection('trips').insertOne(trip, (err, result) => {
      if (err) throw err;
      console.log('trip added');
      res.redirect('/trip/' + trip.id);
    });
  });
});

app.get('/trip/:id', function (req, res) {
  var namespace = '/' + req.params.id;
  var url = req.get('host') + req.originalUrl;

  // Push an object for this namespace into the cachePath array:
  cachePaths.push({
    namespace: namespace,
    latLngs: []
  });

  // Get the current trip data from the database:
  client.connect(err => {
    if (err) throw err;
    var db = client.db('trippie');

    db.collection('trips').findOne({ id: req.params.id }, (err, result) => {
      if (err) throw err;
      var trip = result;
      var namespacePath = cachePaths.find(path => path.namespace == namespace);

      // Connect to the current trip:
      io.of(namespace).use(sharedsession(session, { autoSave: true }));
      io.of(namespace).once('connection', (socket) => {
        // Show to socket who is active:
        activeUsers.forEach(user => {
          if (user.namespace == namespace) {
            socket.emit('add user', user);
            if (user.admin) socket.emit('add cursor', user);
          }
        });

        // Determine if client is admin:
        var admin = trip.admins.find(admin => admin.id == socket.handshake.session.id);
        if (admin) {
          // Give client admin rights:
          socket.join('admin');

          // Add admin to list of active users:
          admin.namespace = namespace;
          activeUsers.push(admin);

          // Show admin is online:
          io.of(namespace).emit('add user', admin);

          // Show admin's cursor to other clients:
          socket.broadcast.emit('add cursor', admin);
        }

        // Show login modal to each client that isn't an admin:
        socket.emit('show login');
        io.of(namespace).to('admin').emit('hide login');

        // Activate maps functions for admins only:
        socket.on('request admin update', () => {
          io.of(namespace).to('admin').emit('enable admin rights');
        });

        // Catch request from client to update path data:
        socket.on('request update path data', () => {
          socket.emit('update path data', trip.path);
        });

        // Add new admin:
        socket.on('add admin', (user) => {
          // Add admin to users array:
          var curUser = activeUsers.find(socket => socket.id == user.id);
          curUser.admin = true;

          // Add admin to database:
          db.collection('trips').updateOne(
            { id: trip.id },
            { $push: { 'admins': {
              id: curUser.id,
              username: curUser.username,
              admin: curUser.admin,
              root: curUser.root
            } } }
          );
        });

        // When a client submits their name:
        socket.on('post user', (user) => {
          // Add client to the active users list:
          user.id = socket.handshake.session.id;
          user.namespace = namespace;
          user.admin = false;
          user.root = false;
          activeUsers.push(user);

          // Show client is online:
          io.of(namespace).emit('add user', user);
        });

        // Temporary console.log:
        if (admin) {
          console.log('Welcome ' + admin.username);
        } else {
          console.log('Welcome random user');
        }

        // Show other client's cursor in real-time:
        socket.on('cursor move', (latlng) => {
          socket.broadcast.emit('change cursor', {
            id: socket.handshake.session.id,
            latlng: latlng
          });
        });

        // Show other client's cursor clicked in real-time:
        socket.on('cursor click', (down) => {
          socket.broadcast.emit('pulse cursor', {
            id: socket.handshake.session.id,
            down: down
          });
        });

        // Add a route segment:
        socket.on('edit route', (latLng) => {
          console.log('latLng: ', latLng);
          // Push coords to the cache data and serve this back to the clients:
          namespacePath.latLngs.push(latLng);
          io.of(namespace).emit('add route segment', namespacePath.latLngs);

          // Update database:
          db.collection('trips').updateOne(
            { id: trip.id },
            { $push: {'path': latLng} }
          );
        });

        // Move the startMarker:
        socket.on('edit startMarker', (latLng) => {
          // Change first coords in path (aka startMarker) and serve it back to the clients:
          namespacePath.latLngs.splice(0, 1, latLng);
          io.of(namespace).emit('change startMarker', namespacePath.latLngs);

          // Update database:
          db.collection('trips').updateOne(
            { id: trip.id },
            { $set: { 'path.0': latLng } }
          );
        });

        // Edit a polyline:
        socket.on('edit polyline', (data) => {
          // Change/add coords in path and serve it back to the clients:
          namespacePath.latLngs.splice(data.idx, data.remove, data.newLatLng);
          io.of(namespace).emit('change polyline', {
            polyline: data.polyline,
            polylinePath: data.polylinePath,
            idx: data.idx,
            path: namespacePath.latLngs
          });

          // Update database:
          if (data.remove == 0) {
            db.collection('trips').updateOne(
              { id: trip.id },
              { $push: { 'path': {
                $each: [data.newLatLng],
                $position: data.idx
              } } }
            );
          } else if (data.remove == 1) {
            var field = 'path.' + data.idx;
            db.collection('trips').updateOne(
              { id: trip.id },
              { $set: { [field]: data.newLatLng } }
            );
          }
        });

        // Delete a polyline:
        socket.on('delete polyline', (data) => {
          // Remove coords from path and serve it back to the clients:
          for (var i = 1; i < data.latLngs.length; i++) {
            namespacePath.latLngs.splice(namespacePath.latLngs.indexOf(data.latLngs[i]), 1);
          }
          io.of(namespace).emit('polyline deleted', {
            polyline: data.polyline,
            path: namespacePath.latLngs
          });

          // Update database:
          db.collection('trips').updateOne(
            { id: trip.id },
            { $pull: { 'path': {
              $in: data.latLngs.splice(1, data.latLngs.length-1)
            } } }
          );
        });

        socket.on('disconnect', () => {
          var curUser = activeUsers.find(user => user.id == socket.handshake.session.id);
          if (curUser && curUser.namespace == namespace) {
            // Remove client from active users list:
            activeUsers.splice(activeUsers.indexOf(curUser), 1);

            // Show the client left:
            io.of(namespace).emit('user left', curUser);

            // If client was an admin, remove his cursor:
            if (curUser.admin) socket.broadcast.emit('remove cursor', curUser);
          }
        });
      });

      res.render('trip', {
        title: result.name.literal,
        location: result.location.literal,
        url: url
      });
      client.close();
    });
  });
});

server.listen(process.env.PORT || 3000);
