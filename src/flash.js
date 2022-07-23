/* global chrome */

import { pageIsSupported } from "./pageRules";

const createFlash = (sourceLocation) => {

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
  flash.appendChild(img);

  const text = document.createElement('span');
  text.appendChild(document.createTextNode('Launch Timing71'));

  flash.appendChild(text);

  if (process.env.NODE_ENV === 'development') {
    const mode = document.createElement('span');
    mode.className = 'mode';
    mode.appendChild(document.createTextNode('[DEV]'));
    flash.appendChild(mode);
  }

  const close = document.createElement('span');
  close.className = 'close';
  close.appendChild(document.createTextNode('[x]'));

  close.onclick = (e) => {
    e.stopPropagation();
    document.body.removeChild(flash);
  };

  flash.appendChild(close);

  flash.onclick = () => {
    chrome.runtime.sendMessage({
      type: 'LAUNCH_T71',
      source: sourceLocation,
      devMode: process.env.NODE_ENV === 'development'
    });
  };

  document.body.appendChild(flash);
};

const checkIframes = async () => {
  const iframes = document.getElementsByTagName('iframe');
  for (let i = 0; i < iframes.length; i++) {
    const iframe = iframes[i];
    const frameSupported = await pageIsSupported(iframe.src);
    if (frameSupported && !document.getElementById('t71_flash')) {
      createFlash(iframe.src);
      return true;
    }
  }
  return false;
};

pageIsSupported(window.location.href).then(
  async (supported) => {
    if (supported) {
      createFlash(window.location.href);
    }
    else {
      const hasIframeNow = await checkIframes();

      if (!hasIframeNow) {
        const callback = (mutations, observer) => {
          [...mutations].forEach(
            async m => {
              [...m.addedNodes].forEach(
                async n => {
                  if (n.tagName === 'IFRAME') {
                    const supported = await pageIsSupported(n.src);
                    if (supported) {
                      observer.disconnect();
                      createFlash(n.src);
                    }
                  }
                  else {
                    const addedIframes = n.getElementsByTagName ? n.getElementsByTagName('iframe') : [];

                    for (let idx = 0; idx < addedIframes.length; idx++) {
                      const i = addedIframes[idx];
                      const supported = await pageIsSupported(i.src);
                      if (supported) {
                        observer.disconnect();
                        createFlash(n.src);
                        break;
                      }
                    }

                  }
                }
              );
              if (m.type === 'attributes' && m.target?.tagName === 'IFRAME') {
                const supported = await pageIsSupported(m.target.src);
                if (supported) {
                  observer.disconnect();
                  createFlash(m.target.src);
                }
              }
            }
          );
        };

        const observer = new MutationObserver(callback);
        observer.observe(document, { attributes: true, childList: true, subtree: true });
      }

    }
  }
);
