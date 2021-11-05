/* global chrome */

const createMeta = (name, value) => {
  const tagNode = document.createElement('meta');
  tagNode.setAttribute('name', name);
  tagNode.setAttribute('value', value);

  document.head.appendChild(tagNode);
};

const createHostIframe = () => {
  const iframe = document.createElement('iframe');
  iframe.src = chrome.runtime.getURL('host.html');
  iframe.style.display = 'none';
  iframe.id = 't71-host-frame';
  document.body.appendChild(iframe);
};

createMeta('X-Timing71-Extension', chrome.runtime.id);
createMeta('X-Timing71-Extension-Version', chrome.runtime.getManifest().version);

createHostIframe();
