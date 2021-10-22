/* global chrome */

import { SUPPORTED_URLS } from "./pageRules";

const createFlash = () => {

  // Make sure Play font is available
  const play = document.createElement('link');
  play.rel = 'stylesheet';
  play.href = 'https://fonts.googleapis.com/css2?family=Play&display=swap';
  document.head.appendChild(play);

  // Then add our "Launch Timing71" button to the page
  const flash = document.createElement('div');
  flash.id = 't71_flash';

  const img = document.createElement('img');
  img.src = chrome.runtime.getURL('logo_32.png');
  img.style.width = '32px';
  img.style.height = '32px';
  flash.appendChild(img);

  const text = document.createElement('span');
  text.appendChild(document.createTextNode('Launch Timing71'));

  flash.appendChild(text);

  const close = document.createElement('span');
  close.className = 'close';
  close.appendChild(document.createTextNode('[x]'));

  close.onclick = (e) => {
    e.stopPropagation();
    document.body.removeChild(flash);
  };

  flash.appendChild(close);

  flash.onclick = () => {
    chrome.runtime.sendMessage({ type: 'LAUNCH_T71', source: window.location.href });
  };

  document.body.appendChild(flash);
};

// Ignore query part of URL
const matchableLocation = `${window.location.origin}${window.location.pathname}`;

for (var i=0; i < SUPPORTED_URLS.length; i++) {
  const pattern = SUPPORTED_URLS[i];
  const match = matchableLocation.search(pattern);
  if (match >= 0) {
    createFlash();
    break;
  }
}
