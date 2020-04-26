import socket from './components/socket.js';
import tripLogin from './components/tripLogin.js';

(function () {
  const app = {
    init: function () {
      socket.init();
      tripLogin.init(socket.namespace);
    }
  };

  app.init();
}) ();
