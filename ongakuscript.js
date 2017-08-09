//=====================================================================
// OngakuScript
//=====================================================================
var OngakuScript = (function () {
  const module = {};

  var timeout = false;
  var loading = false;

  const check = function () {
    const ids = Page.getIDs();
    var idsToCheck = [];
    var cacheResults = {};

    if (timeout) return;
    timeout = true;
    loading = true;

    Page.disableCheck();

    setTimeout(() => {
      timeout = false
      if(!loading) Page.enableCheck();
    }, 1000);

    Page.clearLabels();

    ids.forEach(id => {
      const result = Cache.get(id)
      if (result) {
        cacheResults[id] = result;
        Page.appendLabel(id, result);
      } else {
        idsToCheck.push(id);
      }
    });

    API.checkYoutubeRestrictions(idsToCheck).then(restrictedResults => {
      Page.bulkAppendLabels(restrictedResults);
      Cache.putBulk(restrictedResults, 604800000); // 1 Week
      return idsToCheck.filter(id => !restrictedResults[id]);
    }).then(ids => {
      return API.checkPlayResults(ids);
    }).then(playResults => {
      Page.bulkAppendLabels(playResults);
      Cache.putBulk(playResults, 864000000); // 1 Week

      loading = false;
      if (!timeout) Page.enableCheck();
    });
  }

  module.init = function () {
    Page.addEventListeners();
    Page.appendCheckButton(check);

    var css = document.createElement('link');
    css.rel = "stylesheet";
    css.href = 'https://i.animemusic.me/ongakuscript.css';

    document.querySelector('head').appendChild(css);
  };

  return module;
})();

//=====================================================================
// Page
//=====================================================================
var Page = (function () {
  const module = {};

  const labels = {
    ok: function (date) {
      return {
        text: 'Last played ' + date,
        class: 'label-information'
      }
    },
    unavailable: function (reason) {
      return {
        text: reason,
        class: 'label-error'
      }
    },
    banned: function (reason) {
      return {
        text: 'Banned: ' + reason,
        class: 'label-error'
      }
    },
    UNKNOWN: {
      text: 'Unknown',
      class: 'label-unknown'
    },
    OVERPLAYED: {
      text: 'Overplayed',
      class: 'label-error'
    },
    TODAY: {
      text: 'Played today',
      class: 'label-error'
    },
    WEEK: {
      text: 'Played this week',
      class: 'label-warning'
    },
    MONTH: {
      text: 'Played this month',
      class: 'label-soft-warning'
    },
    ERROR: {
      text: 'Error',
      class: 'label-error'
    }
  }

  const getVerdict = function (result) {
    if (result.status == 'unknown') return labels.UNKNOWN;
    if (result.status == 'deleted') return labels.unavailable('Deleted');
    if (result.status == 'blocked') return labels.unavailable('Blocked in too many regions');
    if (result.status == 'unembeddable') return labels.unavailable('Not embeddable');
    if (result.b == 1) return labels.banned(result.r);
    if (result.o > 0) return labels.OVERPLAYED;
    if (result.t == 1) return labels.TODAY;
    if (result.w == 1) return labels.WEEK;
    if (result.m == 1) return labels.MONTH;

    if (result.b !== 1 && result.o < 1 && result.t == 0 && result.w != 1)
      return labels.ok(result.w);

    return labels.ERROR;
  }

  const insertAfter = function (newNode, referenceNode) {
    referenceNode.parentNode.insertBefore(newNode, referenceNode);
  }

  /**
  * Get the closest matching element up the DOM tree.
  * @private
  * @param  {Element} elem     Starting element
  * @param  {String}  selector Selector to match against
  * @return {Boolean|Element}  Returns null if not match found
  */
  const getClosest = function (elem, selector) {

    // Element.matches() polyfill
    if (!Element.prototype.matches) {
      Element.prototype.matches =
        Element.prototype.matchesSelector ||
        Element.prototype.mozMatchesSelector ||
        Element.prototype.msMatchesSelector ||
        Element.prototype.oMatchesSelector ||
        Element.prototype.webkitMatchesSelector ||
        function (s) {
          var matches = (this.document || this.ownerDocument).querySelectorAll(s),
            i = matches.length;
          while (--i >= 0 && matches.item(i) !== this) { }
          return i > -1;
        };
    }

    // Get closest match
    for (; elem && elem !== document; elem = elem.parentNode) {
      if (elem.matches(selector)) return elem;
    }

    return null;
  };

  const eachElem = function (query, callback) {
    const elems = document.querySelectorAll(query);

    for (var i = 0; i < elems.length; i++) {
      callback(elems[i]);
    }
  }

  const onLabelClick = (result) => (e) => {
    e.preventDefault();

    if (e.ctrlKey && e.shiftKey) {
      if (result.alt === null && result.id !== undefined) {
        window.open('http://i.animemusic.me/animemusic/suggest.php?cid=' + result.id);
      }
    }
  }

  const createLabel = function (result) {
    const verdict = getVerdict(result);
    const label = document.createElement('div');
    const num = result.alt ? result.alt : 0
    label.innerText = verdict.text;
    label.title = verdict.text + '\n' + num + ' known versions';
    label.className = verdict.class + ' label ';
    label.className += ' label-thumb ';

    label.addEventListener('click', onLabelClick(result));

    return label;
  }

  module.appendLabel = function (id, result) {
    eachElem(`a[href^="/watch?v=${id}"].yt-ui-ellipsis`, elem => {
      const label = createLabel(result);
      const parent = elem.parentNode.parentNode.parentNode || {};
      parent.style.position = 'relative';
      parent.firstElementChild.append(label);
    })

    eachElem(`a[href^="/watch?v=${id}"].pl-video-title-link`, elem => {
      const label = createLabel(result);
      const parent = elem.parentNode.parentNode || {};
      const thumb = parent.querySelector('.pl-video-thumbnail') || {};
      thumb.style.position = 'relative';
      thumb.append(label);
    })

    eachElem(`a[href^="/watch?v=${id}"].playlist-video`, elem => {
      const label = createLabel(result);
      const parent = elem.parentNode;
      parent.style.position = 'relative';
      parent.append(label);
    })

    eachElem(`a[href^="/watch?v=${id}"].content-link`, elem => {
      const label = createLabel(result);
      const parent = elem.parentNode.parentNode;
      parent.style.position = 'relative';
      parent.append(label);
    });

    if (document.querySelector('#end')) {
      eachElem(`a[href^="/watch?v=${id}"] img`, elem => {
        const label = createLabel(result);
        elem.parentNode.parentNode.appendChild(label);
      })
    }

    if (window.location.href.indexOf(id) !== -1) {
      if (document.querySelector('#lbl-main')) return;
      const label = createLabel(result);
      label.setAttribute('id', 'lbl-main');
      const title = document.querySelector('h1.title,h1.watch-title-container') || {};
      title.style.position = 'relative';
      label.style.position = 'static';
      label.className += 'label-main'
      title.append(label);
    }
  }

  module.bulkAppendLabels = function (results) {
    for (var key in results) {
      Page.appendLabel(key, results[key]);
    }
  }

  module.clearLabels = function () {
    document.querySelectorAll('.label').forEach(function (node) {
      node.remove();
      node.removeEventListener('click', onLabelClick);
    });
  }

  module.appendCheckButton = function (onCheckClick) {
    const pageButton = document.querySelector('#check-button');
    if (pageButton) pageButton.remove();

    const checkButton = document.createElement('button');

    checkButton.innerHTML = 'Check';
    checkButton.setAttribute('id', 'check-button');
    checkButton.onclick = onCheckClick;

    const newToolbar = document.querySelector('#end');
    const oldToolbar = document.querySelector('#yt-masthead-signin,#yt-masthead-user')

    if (oldToolbar) {
      oldToolbar.insertBefore(checkButton, oldToolbar.firstElementChild)
    }

    if (newToolbar) {
      newToolbar.parentNode.insertBefore(checkButton, newToolbar);
    }
  }

  module.addEventListeners = function () {
    const app = document.querySelector('ytd-app');
    if (!app) return

    app.addEventListener('yt-navigate-finish', function () {
      Page.clearLabels();
    });
  }

  module.getIDs = function () {
    // Convert nodeList to Array
    let elems = [].slice.call(document.querySelectorAll('#video-title'));
    const ids = []

    const selectors = [
      'a[href^="/watch"].content-link', // Related videos
      'a[href^="/watch"].pl-video-title-link', // Playlist list view
      'a[href^="/watch"].playlist-video', // Playlist playing view
      'a[href^="/watch"].yt-ui-ellipsis', // Homepage, Subscriptions, User page & more
      'link[href*="watch"][itemprop="url"]', // Main video
    ]

    const oldElems = [].slice.call(document.querySelectorAll(selectors.join(',')));
    elems = elems.concat(oldElems)

    elems.forEach(function (node) {
      if (!node.href) {
        node = getClosest(node, 'a')
      }
      const id = node.href.match(/watch\?v=([^&]*)/)[1]
      if (!(id in ids)) ids.push(id);
    });

    return ids;
  };

  module.disableCheck = function () {
    const button = document.querySelector('#check-button');
    button.innerHTML = 'Loading...'
    button.className = 'disabled'
  }

  module.enableCheck = function () {
    const button = document.querySelector('#check-button');
    button.innerHTML = 'Check'
    button.className = '';
  }

  return module;
})();

//=====================================================================
// Cache
//=====================================================================
var Cache = (function () {
  const module = {};

  module.get = function (key) {
    const item = window.localStorage.getItem('ongaku-' + key);
    return item ? JSON.parse(item) : null
  };

  module.put = function (key, value, expiration) {
    value.expiration = Date.now() + expiration;
    value = JSON.stringify(value);
    window.localStorage.setItem("ongaku-" + key, value);
  };

  module.putBulk = function (data, expiration) {
    for (var key in data) {
      this.put(key, data[key], expiration);
    }
  };

  module.clearAll = function () {
    for (var key in window.localStorage) {
      var item = window.localStorage.getItem(key);

      if (key.startsWith("ongaku-"))
        window.localStorage.removeItem(key);
    }
  }

  return module;
})();
//=====================================================================
// API
//=====================================================================
var API = (function () {
  const module = {};

  const countryList = {
    US: 10,
    BR: 7, CA: 7, FR: 7, GB: 7,
    AU: 3, CZ: 3, LT: 3,
    ES: 2, MY: 2, NO: 2, RU: 2, SE: 2, SG: 2, TH: 2,
    AE: 1, AR: 1, BE: 1, BG: 1, CH: 1, CL: 1, DK: 1, EE: 1, FI: 1, GR: 1, HK: 1,
    HR: 1, HU: 1, ID: 1, IE: 1, IN: 1, IS: 1, IT: 1, LV: 1, MX: 1, NL: 1, NZ: 1,
    PE: 1, PH: 1, PL: 1, PT: 1, RO: 1, RS: 1, SK: 1, SK: 1, TR: 1, TW: 1, UA: 1,
    VN: 1,
    DE: 0, JP: 0
  }

  module.checkYoutubeRestrictions = function (ids) {
    return checkYoutube(ids.slice(0, 49))
  };

  const checkYoutube = function (ids) {
    const url = 'https://www.googleapis.com/youtube/v3/videos';
    const key = 'AIzaSyC8r6l_h-bGvcMzeZy01IwW9l6pJapuKYU';
    const part = "status,contentDetails";
    const id = ids.join(",");
    const params = '?key=' + key + '&part=' + part + '&id=' + id;

    return Http.request('GET', url + params).then(response => {
      return parseYoutubeRestrictions(response);
    })
  }

  const parseYoutubeRestrictions = function (response) {
    var results = {};

    if (!("items" in response))
      return;

    var items = response.items;

    for (var index in items) {
      var status = items[index].status
      if (status.uploadStatus == 'rejected' || status.uploadStatus == 'deleted')
        results[items[index].id] = { status: "deleted" };
      else if (!status.embeddable)
        results[items[index].id] = { status: "unembeddable" };
      else if ("regionRestriction" in items[index].contentDetails) {
        var restrict = items[index].contentDetails.regionRestriction;
        var score = 0;
        var result = {};
        var allowlist = "allowed" in restrict;

        if (allowlist)
          for (var c = 0; c < restrict.allowed.length; ++c)
            result[restrict.allowed[c]] = true;

        if ("blocked" in restrict)
          for (var c = 0; c < restrict.blocked.length; ++c)
            result[restrict.blocked[c]] = false;

        for (var country in countryList)
          if (!(country in result))
            result[country] = !allowlist;

        for (var country in result)
          if (!result[country] && country in countryList)
            score += countryList[country];

        if (score > 16)
          results[items[index].id] = { status: "blocked" };
      }
    }
    return results;
  };

  const checkPlays = function (ids) {
    const data = ids.map(id => ({ cid: id }));
    const url = 'https://i.animemusic.me/animemusic/check.php?dj=-1&source=ongakuscript';

    if (ids.length === 0) return;

    return Http.request('POST', url, JSON.stringify(data)).then(response => {
      return parsePlays(response, ids);
    });
  }

  module.checkPlayResults = function (ids) {
    return checkPlays(ids.slice(0, 49));
  }

  const parsePlays = function (response, ids) {
    var results = {};

    for (var i in response) {
      var result = response[i];
      results[result.id] = response[i];
    }

    for (var i in ids) {
      if (results[ids[i]] == undefined)
        results[ids[i]] = { status: "unknown" };
    }
    return results;
  }

  return module;
})();

//=====================================================================
// Http
//=====================================================================
var Http = (function () {
  const module = {};

  module.request = function (method, url, data) {
    var data = data || '';
    return new Promise(function (resolve, reject) {
      var req = new XMLHttpRequest();
      req.open(method, url);

      req.onload = function () {
        if (req.status == 200) {
          resolve(req.response);
        }
        else {
          reject(Error(req.statusText));
        }
      };
      req.onerror = function () {
        reject(Error("Something went wrong ... "));
      };
      req.send(data);
    }).then(response => {
      return JSON.parse(response);
    });
  }
  return module;
})();

(function () {
  OngakuScript.init();
})();
