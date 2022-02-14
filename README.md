# Timing71 Beta Chrome extension

![GitHub package.json version](https://img.shields.io/github/package-json/v/timing71/beta-chrome)
![GitHub Workflow Status](https://img.shields.io/github/workflow/status/timing71/beta-chrome/CI)
![AGPL v3.0](https://img.shields.io/github/license/timing71/beta-chrome)
![Twitter Follow](https://img.shields.io/twitter/follow/timing_71?style=social)

This repo is the source code to the [Chrome extension](https://chrome.google.com/webstore/detail/timing71/pjdcehojcogjpilmeliklfddboeoogpd)
for [Timing71 Beta](https://beta.timing71.org/), a motorsport live timing and
analysis system that runs in a user's browser.

The plugin is a thin layer of code that enables in-browser functionality for
code hosted at [beta.timing71.org](https://beta.timing71.org), including:

* Access to extended storage/IndexedDB
* Cross-origin communication
* Asynchronous generation of replay files
* Display of "Launch" button on supported timing provider sites
* Extension menu options

Due to [run-time restrictions imposed by Chrome's Manifest V3](https://bugs.chromium.org/p/chromium/issues/detail?id=1152255),
the majority of functionality here is in `host.js`, which runs via an iframe
injected by `injector.js` into the host pages at `beta.timing71.org`, rather
than as a background service worker. That iframe runs with the permissions of
the Chrome extension so is able to establish connections to timing providers.

## Configuration

Configuration is loaded at runtime from `beta.timing71.org` and cached in local
storage by `config.js`.

## Database structure

The service database is defined in `services.js` and contains three tables:

* `services`: storing the start time and data source for each _service_
  (e.g. an instance of a connection to a timing provider for a race event).
* `service_states`: stores every timing screen state for a service. These states
  are loosely the same as the Common Timing Format states described
  [here](https://info.timing71.org/reference/state.html), but with additional
  entries to support various features, including the [service manifest](https://info.timing71.org/reference/manifest.html).
* `service_analyses`: stores the current analysis state for a service.
