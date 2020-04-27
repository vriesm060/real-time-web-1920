export default {
  elem: document.querySelector('.cursors'),
  createCursor: function (user) {
    var cursor = document.createElement('div');
    cursor.classList.add('cursor');
    cursor.classList.add(user.id);
    cursor.textContent = user.username.slice(0,1);
    this.elem.appendChild(cursor);
  },
  removeCursor: function (user) {
    var curCursor = Array.from(this.elem.children).find(child => child.classList.contains(user.id));
    curCursor.parentNode.removeChild(curCursor);
  },
  changeCursorPosition: function (cursor) {
    var curCursor = Array.from(this.elem.children).find(child => child.classList.contains(cursor.id));
    if (curCursor) curCursor.style.transform = 'translate(' + cursor.position.x + 'vw,' + cursor.position.y + 'vh)';
  },
  init: function (namespace) {
    namespace
      .on('add cursor', (user) => {
        this.createCursor(user);
      })
      .on('remove cursor', (user) => {
        this.removeCursor(user);
      })
      .on('change cursor', (cursor) => {
        this.changeCursorPosition(cursor);
      });

    document.addEventListener('mousemove', (e) => {
      namespace.emit('cursor', {
        x: (e.clientX / document.body.offsetWidth) * 100,
        y: (e.clientY / document.body.offsetHeight) * 100
      });
    });
  }
};
