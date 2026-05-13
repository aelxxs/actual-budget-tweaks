// ── DOM helper ────────────────────────────────────────────────────────
export function el(tag, props, children) {
  const node = document.createElement(tag);
  if (props) {
    for (const k in props) {
      if (k === 'class') node.className = props[k];
      else if (k === 'style') Object.assign(node.style, props[k]);
      else if (k === 'dataset') Object.assign(node.dataset, props[k]);
      else if (k === 'text') node.textContent = props[k];
      else if (k === 'on') {
        for (const ev in props.on) node.addEventListener(ev, props.on[ev]);
      } else node.setAttribute(k, props[k]);
    }
  }
  if (children) {
    for (const c of children) {
      if (c == null || c === false) continue;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
  }
  return node;
}
