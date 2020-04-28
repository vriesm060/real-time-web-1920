export default {
  list: document.querySelector('.active-users__list'),
  addUser: function (user) {
    var fragment = document.createDocumentFragment();
    var li = document.createElement('li');
    var a = document.createElement('a');
    var initial = document.createElement('span');
    var fullname = initial.cloneNode(true);

    li.classList.add(user.id);
    fragment.appendChild(li);

    a.classList.add('user');
    if (user.admin) a.classList.add('admin');
    li.appendChild(a);

    initial.classList.add('user__initial');
    initial.textContent = user.username.slice(0,1);
    a.appendChild(initial);

    fullname.classList.add('user__fullname');
    fullname.textContent = user.username;
    a.appendChild(fullname);

    this.list.appendChild(fragment);
  },
  removeUser: function (user) {
    var curUser = Array.from(this.list.children).find(child => child.classList.contains(user.id));
    curUser.parentNode.removeChild(curUser);
  },
  init: function (namespace) {
    namespace
      .on('add user', (user) => {
        this.addUser(user);
      })
      .on('user left', (user) => {
        this.removeUser(user);
      });
  }
};
