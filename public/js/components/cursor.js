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
  changeCursorPosition: function (id, point) {
    var curCursor = Array.from(this.elem.children).find(child => child.classList.contains(id));
    if (curCursor) curCursor.style.transform = 'translate(' + point.x + 'px,' + point.y + 'px)';
  },
  pulseCursor: function (id, down) {
    var curCursor = Array.from(this.elem.children).find(child => child.classList.contains(id));
    var size = down ? .5 : 0;
    curCursor.style.boxShadow = '0 0 0 ' + size + 'rem rgba(44,44,44,.2)';
  },
  init: function (namespace) {
    namespace
      .on('add cursor', (user) => {
        this.createCursor(user);
      })
      .on('remove cursor', (user) => {
        this.removeCursor(user);
      })
      .on('pulse cursor', (cursor) => {
        this.pulseCursor(cursor.id, cursor.down);
      });
  }
};
