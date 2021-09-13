/* global chrome */

const createMeta = (name, value) => {
  const tagNode = document.createElement('meta');
  tagNode.setAttribute('name', name);
  tagNode.setAttribute('value', value);

  document.head.appendChild(tagNode);
};

createMeta('X-Timing71-Extension', chrome.runtime.id);
createMeta('X-Timing71-Extension-Version', chrome.runtime.getManifest().version);
