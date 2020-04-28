import socket from './components/socket.js';
import tripLogin from './components/tripLogin.js';
import activeUsers from './components/activeUsers.js';
import shareLink from './components/shareLink.js';
import cursor from './components/cursor.js';
import map from './components/map.js';

(function () {
  const app = {
    init: function () {
      socket.init();
      tripLogin.init(socket.namespace);
      activeUsers.init(socket.namespace);
      shareLink.init();
      cursor.init(socket.namespace);
      map.initMap(socket.namespace);
    }
  };

  app.init();
}) ();
