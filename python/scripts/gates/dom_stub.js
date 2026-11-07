'use strict';
/* 一份最小的假 DOM —— 只为在 node 里真把 PyInteract.mount() 跑起来。

   两个用户：`core/interact.test.js`（node 分支，require 进来）与
   `gates/syntax.py` 的 `py_state_bridge_check`（在 node 外层进程里建好假 window，
   再把它当成 vm 裸 context 的全局对象，工具页的内联脚本在里面原样执行）。

   放在 scripts/gates/ 而不是 core/：core/ 下的每个 .js 都被当成编辑源普查
   （core_modules()、lazy_dep_check、browser_branch_check…），一个测试替身混进去
   会被当成第八个模块。

   取舍：只实现 mount 与工具页手写区实际碰到的那些成员；碰到没实现的就让它抛——
   一个「什么属性都返回空函数」的宽松桩会把真实的调用错误一并吞掉。 */

function ClassList(el) { this.el = el; }
ClassList.prototype._list = function () {
  return String(this.el.className || '').split(/\s+/).filter(Boolean);
};
ClassList.prototype.add = function () {
  const l = this._list();
  for (let i = 0; i < arguments.length; i++) { if (l.indexOf(arguments[i]) === -1) { l.push(arguments[i]); } }
  this.el.className = l.join(' ');
};
ClassList.prototype.remove = function () {
  const rm = Array.prototype.slice.call(arguments);
  this.el.className = this._list().filter(function (c) { return rm.indexOf(c) === -1; }).join(' ');
};
ClassList.prototype.contains = function (c) { return this._list().indexOf(c) !== -1; };
ClassList.prototype.toggle = function (c, force) {
  const on = force === undefined ? !this.contains(c) : !!force;
  if (on) { this.add(c); } else { this.remove(c); }
  return on;
};

function Node(doc, tag) {
  this.ownerDocument = doc;
  this.tagName = String(tag).toUpperCase();
  this.nodeName = this.tagName;
  this.childNodes = [];
  this.parentNode = null;
  this.attributes = {};
  this.listeners = {};
  this.className = '';
  this.id = '';
  this.value = '';
  this.selectionStart = 0;
  this.selectionEnd = 0;
  this.scrollTop = 0;
  this.scrollLeft = 0;
  this.disabled = false;
  this.hidden = false;
  this.title = '';
  this._text = '';
  this.classList = new ClassList(this);
  const style = {};
  style.setProperty = function (k, v) { style[k] = v; };
  style.removeProperty = function (k) { delete style[k]; };
  this.style = style;
  this.dataset = {};
}
Object.defineProperty(Node.prototype, 'firstChild', { get: function () { return this.childNodes[0] || null; } });
Object.defineProperty(Node.prototype, 'lastChild', {
  get: function () { return this.childNodes[this.childNodes.length - 1] || null; }
});
Object.defineProperty(Node.prototype, 'children', { get: function () { return this.childNodes.slice(); } });
Object.defineProperty(Node.prototype, 'textContent', {
  get: function () {
    return this._text + this.childNodes.map(function (c) { return c.textContent; }).join('');
  },
  set: function (v) {
    this.childNodes.forEach(function (c) { c.parentNode = null; });
    this.childNodes = [];
    this._text = (v === null || v === undefined) ? '' : String(v);
  }
});
Node.prototype._detach = function (child) {
  if (child.parentNode) {
    const sib = child.parentNode.childNodes;
    const at = sib.indexOf(child);
    if (at !== -1) { sib.splice(at, 1); }
    child.parentNode = null;
  }
};
Node.prototype.appendChild = function (child) {
  this._detach(child);
  child.parentNode = this;
  this.childNodes.push(child);
  return child;
};
Node.prototype.insertBefore = function (child, ref) {
  if (!ref) { return this.appendChild(child); }
  this._detach(child);
  const at = this.childNodes.indexOf(ref);
  if (at === -1) { throw new Error('insertBefore: ref 不是这个节点的子节点'); }
  child.parentNode = this;
  this.childNodes.splice(at, 0, child);
  return child;
};
Node.prototype.removeChild = function (child) {
  if (child.parentNode !== this) { throw new Error('removeChild: 不是这个节点的子节点'); }
  this._detach(child);
  return child;
};
Node.prototype.setAttribute = function (k, v) {
  this.attributes[k] = String(v);
  if (k === 'id') { this.id = String(v); }
  if (k === 'class') { this.className = String(v); }
};
Node.prototype.getAttribute = function (k) {
  return Object.prototype.hasOwnProperty.call(this.attributes, k) ? this.attributes[k] : null;
};
Node.prototype.removeAttribute = function (k) { delete this.attributes[k]; };
Node.prototype.addEventListener = function (type, fn) {
  (this.listeners[type] = this.listeners[type] || []).push(fn);
};
Node.prototype.removeEventListener = function (type, fn) {
  const l = this.listeners[type] || [];
  const at = l.indexOf(fn);
  if (at !== -1) { l.splice(at, 1); }
};
/* 不冒泡：本桩只需要「在这个节点上触发它自己的监听」。 */
Node.prototype.dispatch = function (type, extra) {
  const ev = Object.assign({ type: type, target: this, preventDefault: function () {} }, extra || {});
  (this.listeners[type] || []).slice().forEach(function (fn) { fn.call(this, ev); }, this);
  return ev;
};
Node.prototype.focus = function () {
  if (this.ownerDocument.activeElement === this) { return; }
  this.ownerDocument.activeElement = this;
  this.dispatch('focus');
};
Node.prototype.blur = function () {
  if (this.ownerDocument.activeElement !== this) { return; }
  this.ownerDocument.activeElement = this.ownerDocument.body;
  this.dispatch('blur');
};
Node.prototype.click = function () { this.dispatch('click'); };
Node.prototype.select = function () {};
Node.prototype.setSelectionRange = function (a, b) { this.selectionStart = a; this.selectionEnd = b; };
Node.prototype.scrollIntoView = function () {};
Node.prototype.getBoundingClientRect = function () {
  return { top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 };
};
Node.prototype.walk = function (fn) {
  fn(this);
  this.childNodes.forEach(function (c) { c.walk(fn); });
};
Node.prototype.findAll = function (pred) {
  const out = [];
  this.walk(function (n) { if (pred(n)) { out.push(n); } });
  return out;
};
Node.prototype.querySelectorAll = function () { return []; };
Node.prototype.querySelector = function () { return null; };

/* makeWindow({ search, origin, ids }) → 假 window（也是假 document 的 defaultView）。
     search  location.search，缺省 ''
     origin  location.origin，缺省 'http://127.0.0.1:8000'
     ids     预先挂在 body 上、getElementById 找得到的元素 id（工具页手写区要 stage / h1 / …）
   window.parent 缺省指向自己——与「单独打开、没有父窗口」的真实浏览器一致。 */
function makeWindow(opts) {
  opts = opts || {};
  const win = {};
  const doc = {
    listeners: {},
    visibilityState: 'visible',
    defaultView: win,
    createElement: function (tag) { return new Node(doc, tag); },
    createTextNode: function (text) { const n = new Node(doc, '#text'); n.textContent = text; return n; },
    getElementById: function (id) {
      let hit = null;
      doc.documentElement.walk(function (n) { if (!hit && n.id === id) { hit = n; } });
      return hit;
    },
    querySelector: function () { return null; },
    querySelectorAll: function () { return []; },
    addEventListener: Node.prototype.addEventListener,
    removeEventListener: Node.prototype.removeEventListener,
    dispatch: function (type, extra) {
      const ev = Object.assign({ type: type, target: doc.activeElement, preventDefault: function () {} },
                               extra || {});
      (doc.listeners[type] || []).slice().forEach(function (fn) { fn(ev); });
      return ev;
    },
    execCommand: function () { return false; }
  };
  doc.documentElement = new Node(doc, 'html');
  doc.head = doc.documentElement.appendChild(new Node(doc, 'head'));
  doc.body = doc.documentElement.appendChild(new Node(doc, 'body'));
  doc.activeElement = doc.body;
  (opts.ids || []).forEach(function (id) {
    const el = new Node(doc, 'div');
    el.id = id;
    doc.body.appendChild(el);
  });

  const origin = opts.origin || 'http://127.0.0.1:8000';
  const search = opts.search || '';
  win.document = doc;
  win.window = win;
  win.self = win;
  win.parent = win;
  win.location = { origin: origin, search: search, href: origin + '/tools/page.html' + search };
  win.navigator = {};
  win.listeners = {};
  win.addEventListener = Node.prototype.addEventListener;
  win.removeEventListener = Node.prototype.removeEventListener;
  win.confirm = function () { return true; };
  win.history = { replaceState: function () {} };
  /* 自己给自己发消息不是这座桥的任何合法用法：单独打开时 parent === window，
     这里一旦被调用，就说明「没有父窗口时一行都不执行」破了。 */
  win.selfPosts = [];
  win.postMessage = function (msg, target) { win.selfPosts.push({ msg: msg, target: target }); };
  return win;
}

/* 一个假的父窗口：记下收到的每一条 postMessage。 */
function makeParent() {
  const p = { posts: [] };
  p.postMessage = function (msg, target) { p.posts.push({ msg: msg, target: target }); };
  return p;
}

module.exports = { makeWindow: makeWindow, makeParent: makeParent, Node: Node };
