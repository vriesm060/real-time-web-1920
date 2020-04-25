export default {
  form: document.querySelector('.travel-input'),
  init: function (socket) {
    var id;
    socket.on('id', (socketId) => {
      id = socketId;
    });

    // Post travel data to socket on submit:
    this.form.addEventListener('submit', (e) => {
      var hiddenField = document.createElement('input');
      hiddenField.type = 'hidden';
      hiddenField.name = 'socketId';
      hiddenField.value = id;
      e.target.appendChild(hiddenField);
      e.target.submit();
      e.preventDefault();
    });
  }
};
