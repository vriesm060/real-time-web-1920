import socket from './components/socket.js';
import travelInput from './components/travelInput.js';

(function () {
  const app = {
    init: function () {
      socket.init();
      travelInput.init(socket.main);

    }
  };

  app.init();
}) ();
