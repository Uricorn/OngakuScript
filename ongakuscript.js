var Cache = {
  storageAvailable: function() {
    try {
      var storage = window.localStorage,
          x = '__storage_test__';
      storage.setItem(x,x);
      storage.removeItem(x);
      return true;
    }
    catch(e) {
      return false;
    }
  },
  clearExpired: function() {
    if (!this.storageAvailable)
      return;

    var storage = window.localStorage;

    for(var key in storage) {
      var item = storage.getItem(key);
      if (item !== null) {
        var video = JSON.parse(item);
        if (Date.now() > video.expiration)
          storage.removeItem(key);
      }
    }
  },
  clearAll: function() {
    if (!this.storageAvailable)
      return;

    var storage = window.localStorage;

    for(var key in storage) {
      var item = storage.getItem(key);

      if (item !== null && !key.startsWith("yt") && !key.startsWith("google"))
        storage.removeItem(key);
    }
  },
  getResults: function(IDs) {
    if (!this.storageAvailable)
      return [];

    var storage = window.localStorage;

    return IDs.reduce(function(obj, id) {
      var item = storage.getItem(id);
      if (item !== null)
        obj[id] = JSON.parse(storage.getItem(id));
      return obj;
    }, {});
  },
  storeResults: function(results, expiration) {
    if (!this.storageAvailable)
      return;

    var storage = window.localStorage;

    for(var id in results) {
      var result = results[id];

      if (result.b && result.b == 1)
        expiration = 604800000;

      result.expiration = Date.now() + expiration;
      storage.setItem(id, JSON.stringify(result));
    }
  },
  filterUncached: function(IDs) {
    if (!this.storageAvailable)
      return;

    var storage = window.localStorage;

    return IDs.filter(function(id) {
      return storage.getItem(id) !== null;
    });
  },
  getUncached: function(IDs) {
    if (!this.storageAvailable)
      return;

    var storage = window.localStorage;

    return IDs.filter(function(id) {
      return storage.getItem(id) == null;
    });
  }
};

var Templates = {
  styles: {
    information: {
      color: "#120c0c",
      background: "#aa74ff"
    },
    error: {
      background: "#c42e3b"
    },
    softWarning: {
      color: "#120c0c",
      background: "#f3e115"
    },
    unknown: {
      color: "#120c0c",
      background: "#f8b2ea"
    },
    warning: {
      color: "#120c0c",
      background: "#ffdd6f"
    }
  },
  messages: {
    unknown: {
      text: 'Unknown',
      type: 'unknown'
    },
    banned: {
      text: 'Banned',
      type: 'error'
    },
    overplayed: {
      text: 'Overplayed',
      type: 'error'
    },
    today: {
      text: 'Played today',
      type: 'error'
    },
    week: {
      text: 'Played this week',
      type: 'warning'
    },
    month: {
      text: 'Played this month',
      type: 'softWarning'
    },
    error: {
      text: 'Error',
      type: 'error'
    },
    unavailable: function(reason) {
      return {
        text: reason,
        type: 'error'
      }
    },
    ok: function(date) {
      return {
        text: 'Last played ' + date,
        type: 'information'
      }
    },
  },
  labels: {
    labelNormal: {
      fontSize: "11px",
      marginTop: "4px",
      padding: "2px 6px",
      color: "white",
      borderRadius: "3px",
      display: "inline-block",
      marginLeft: "5px"
    },
    labelWide: {
      color: "white",
      fontSize: "11px",
      marginTop: "4px",
      padding: "2px 4px",
      color: "white",
      borderRadius: "3px",
      maxWidth: "200px",
      textAlign: "center"
    },
    labelSmall: {
      color: "white",
      display: "inline-block",
      fontSize: "10px",
      padding: "1px 6px",
      position: "relative",
      top: "-1px",
      padding: "2px 6px",
      marginLeft: "5px",
      borderRadius: "3px",
      marginTop: "0px",
      lineHeight: "14px",
    },
    labelLarge: {
      display: "inline-block",
      color: "white",
      fontSize: "15px",
      marginLeft: "5px",
      position: "relative",
      top: "-2px",
      padding: "4px 8px",
      borderRadius: "4px",
      verticalAlign: "bottom",
      maxWidth: "250px",
      textAlign: "center"
    }
  },
  checkButton: $('<a class="yt-uix-button yt-uix-sessionlink yt-uix-button-default yt-uix-button-size-default" id="check-btn"><span class="yt-uix-button-content" style="vertical-align: middle;">Check</span></a>').css({
    marginRight: "10px",
    paddingLeft: "15px",
    paddingRight: "15px"
  })
}

var Youtube = {
  insertCheckButton: function() {
    $('#yt-masthead-user').prepend(Templates.checkButton);
    $('#yt-masthead-signin').prepend(Templates.checkButton);
    return $('#check-btn');
  },
  getVideoElems: function() {
    var selectors = [
      'a[href^="/watch"].content-link', // Related videos
      'a[href^="/watch"].pl-video-title-link', // Playlist list view
      'a[href^="/watch"].playlist-video', // Playlist playing view
      'a[href^="/watch"].yt-ui-ellipsis', // Homepage, Subscriptions, User page & more
      'link[href*="watch"][itemprop="url"]', // Main video
    ]
    return $(selectors.join(','));
  },
  parseIDs: function(elems) {
    return elems.map(function(i, elem) {
      return elem.href.match(/watch\?v=([^&]*)/)[1];
    }).toArray();
  },
  insertLabels: function(elems, IDs, results) {
    if ($.isEmptyObject(results))
      return;

    elems.each(function(index, elem) {
      var id = IDs[index];
      if (results[id])
        this.appendLabel(elem, results[id]);
    }.bind(this));
  },
  insertUnknownLabels: function(elems, IDs) {
    elems.each(function(index, elem) {
      var id = IDs[index];
      this.appendLabel(elem, {status: "unknown"});
    });
  },
  appendLabel: function(elem, result) {
    if ($(elem).hasClass('yt-ui-ellipsis')) {
      var label = this.createLabel(result, Templates.labels.labelWide);
      var margin = 34 - $(elem).height();
      label.css("marginTop",margin + "px");
      $(label).insertAfter($(elem).parent().parent().find('.yt-lockup-meta'));
    }
    else if ($(elem).hasClass('content-link')) {
      var label = this.createLabel(result, Templates.labels.labelSmall);
      $(elem).find('.view-count').append(label);
    }
    else if ($(elem).hasClass('pl-video-title-link')) {
      var label = this.createLabel(result, Templates.labels.labelNormal);
      $(elem).parent().append(label);
    }
    else if ($(elem).hasClass('playlist-video')) {
      var label = this.createLabel(result, Templates.labels.labelNormal);
      $(elem).find('.video-uploader-byline').append(label);
    }
    else if (elem.tagName == 'LINK') {
      var label = this.createLabel(result, Templates.labels.labelLarge);
      $('#eow-title').append(label);
    }
  },
  createLabel: function(result, labelType) {
    var verdict = this.getVerdict(result);
    var elem = $('<div class="ongaku-label"></div>');
    elem.css(labelType);
    elem.text(verdict.text);
    elem.css(Templates.styles[verdict.type]);
    return elem;
  },
  getVerdict: function(result) {
    if (result.status == 'unknown') return Templates.messages.unknown;
    if (result.status == 'deleted') return Templates.messages.unavailable('Deleted');
    if (result.status == 'blocked') return Templates.messages.unavailable('Blocked in too many regions');
    if (result.status == 'unembeddable') return Templates.messages.unavailable('Not embeddable');
	  if (result.b == 1) return Templates.messages.banned;
	  if (result.o > 0) return Templates.messages.overplayed;
	  if (result.t == 1) return Templates.messages.today;
	  if (result.w == 1) return Templates.messages.week;
	  if (result.m == 1) return Templates.messages.month;

    if(result.b !== 1 && result.o < 1 && result.t == 0 && result.w != 1)
		  return Templates.messages.ok(result.w);

    return Templates.messages.error;
  },
  enqueue: function(IDs, callback) {
    var IDsToCheck = $.extend([], IDs);
    while(IDsToCheck.length) {
      // Max of 50 songs per request
      callback(IDsToCheck.splice(0,50));
    }
  },
  checkRestrictions: function(IDs, callback) {
    var data = {
      key: 'AIzaSyC8r6l_h-bGvcMzeZy01IwW9l6pJapuKYU',
      part: "status,contentDetails",
      id: IDs.join(",")
    }

    $.getJSON(
      'https://www.googleapis.com/youtube/v3/videos',
      data,
      function(response) {
        this.parseRestrictions(response, callback);
      }.bind(this)
    )
  },
  checkStatus: function(IDs, callback) {
    var payload = [];

    for(var i in IDs)
      payload.push({cid: IDs[i]});

    if (payload.length > 0) {
      $.post(
        'https://i.animemusic.me/animemusic/check.php?dj=-1&source=ongakuscript',
        JSON.stringify(payload),
        function(response) {
          this.parseStatus(response, IDs, callback);
        }.bind(this),
        'json'
      );
    }
  },
  parseStatus: function(response, IDs, callback) {
    var results = {};

    for(var i in response) {
      var result = response[i];
      results[result.id] = response[i];
    }

    for(var i in IDs) {
      if (results[IDs[i]] == undefined)
        results[IDs[i]] = {status: "unknown"};
    }

    callback(results);
  },
  filterResults: function(IDs, results) {
    if (results === undefined)
      return IDs;

    return IDs.filter(function(id) {
      return !results[id];
    })
  },
  filterDuplicates: function(list) {
    return list.filter(function(elem, index, self) {
      return index == self.indexOf(elem);
    });
  },
  countryList: {
		US: 10,

		BR: 7, CA: 7, FR: 7, GB: 7,

		AU: 3, CZ: 3, LT: 3,

		ES: 2, MY: 2, NO: 2, RU: 2, SE: 2, SG: 2, TH: 2,

		AE: 1, AR: 1, BE: 1, BG: 1, CH: 1, CL: 1, DK: 1, EE: 1, FI: 1, GR: 1, HK: 1,
		HR: 1, HU: 1, ID: 1, IE: 1, IN: 1, IS: 1, IT: 1, LV: 1, MX: 1, NL: 1, NZ: 1,
		PE: 1, PH: 1, PL: 1, PT: 1, RO: 1, RS: 1, SK: 1, SK: 1, TR: 1, TW: 1, UA: 1,
		VN: 1,

		DE: 0, JP: 0 // Sorry..
  },
  parseRestrictions: function(response, callback) {
    var results = {};

    if (!("items" in response))
      return;

    var items = response.items;

    for(var index in items) {
      var status = items[index].status
      if (status.uploadStatus == 'rejected' || status.uploadStatus == 'deleted')
        results[items[index].id] = {status: "deleted"};
      else if(!status.embeddable)
        results[items[index].id] = {status: "unembeddable"};
      else if("regionRestriction" in items[index].contentDetails){
        var restrict = items[index].contentDetails.regionRestriction;
			  var score = 0;
			  var result = {};
			  var allowlist = "allowed" in restrict;

			  if(allowlist)
				  for(var c = 0; c < restrict.allowed.length; ++c)
					  result[restrict.allowed[c]] = true;

			  if("blocked" in restrict)
				  for(var c = 0; c < restrict.blocked.length; ++c)
					  result[restrict.blocked[c]] = false;

			  for(var country in this.countryList)
				  if(!(country in result))
					  result[country] = !allowlist;

			  for(var country in result)
				  if(!result[country] && country in this.countryList)
					  score += this.countryList[country];

        if (score > 16)
          results[items[index].id] = {status: "blocked"};
      }

    }

    callback(results);
  }
};

window.Cache = Cache;
Cache.clearExpired();

Youtube.insertCheckButton().on('click', function() {
  Cache.clearExpired();
  $('.ongaku-label').remove();

  var elems = Youtube.getVideoElems();
  var IDs = Youtube.parseIDs(elems);
  var uniqueIDs = Youtube.filterDuplicates(IDs);
  var cacheResults = Cache.getResults(IDs);
  var IDsToCheck = Youtube.filterResults(uniqueIDs, cacheResults);

  Youtube.insertLabels(elems, IDs, cacheResults);

  Youtube.enqueue(IDsToCheck, function(IDChunk) {
    Youtube.checkRestrictions(IDChunk, function(results) {
      Youtube.insertLabels(elems, IDs, results);

      Cache.storeResults(results, 604800000) // 1 week
      IDsToCheck = Youtube.filterResults(IDChunk, results);

      Youtube.checkStatus(IDsToCheck, function(results) {
        Youtube.insertLabels(elems, IDs, results);

        Cache.storeResults(results, 86400000); // 24 hours
      });
    });
  });
});
