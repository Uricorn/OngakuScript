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
    var storage = window.localStorage;
    if (this.storageAvailable) {
      for(var key in storage) {
        var item = JSON.parse(storage.getItem(key));
        if (item !== null) {
          if (Date.now() > item.expiration)
            storage.removeItem(key);
        }
      }
    }
  },
  clearAll: function() {
    var storage = window.localStorage;
    if (this.storageAvailable) {
      for(var key in storage) {
        var item = JSON.parse(storage.getItem(key));
        if (item !== null) {
          if(item.expiration !== null)
            storage.removeItem(key);
        }
      }
    }
  },
  getUncached: function(videos) {
    var uncached = [];

    for(var i in videos) {
      if (!this.get(videos[i].id)) {
        uncached.push(videos[i].id);
      }
    }
    return uncached;
  },
  put: function(key, value) {
    if (this.storageAvailable) {
      var storage = window.localStorage;
      value.expiration = Date.now() + 86400000; // 24 hours expiration
      storage.setItem(key, JSON.stringify(value));
    }
  },
  get: function(key) {
    if (!this.storageAvailable)
      return false;

    var storage = window.localStorage;
    var obj = JSON.parse(storage.getItem(key));

    if (obj) {
      if (Date.now() > obj.expiration) {
        storage.removeItem(key);
        return false;
      }
      return obj;
    }
    return false;
  }
};

var Youtube = {
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
    ok: function(date) {
      return {
        text: 'Last played ' + date,
        type: 'information'
      }
    },
    error: {
      text: 'Error',
      type: 'error'
    }
  },
  insertCheckButton: function() {
    var checkButton = $('<a class="yt-uix-button yt-uix-sessionlink yt-uix-button-default yt-uix-button-size-default" id="check-btn"><span class="yt-uix-button-content" style="vertical-align: middle;">Check</span></a>');

    checkButton.css( {
      marginRight: "10px",
      paddingLeft: "15px",
      paddingRight: "15px"
    });

    $('#yt-masthead-user').prepend(checkButton);
    $('#yt-masthead-signin').prepend(checkButton);
    return $('#check-btn');
  },
  getVideoIDs: function() {
    var songs = [];
    var selectors = [
      'a[href^="/watch"].content-link', // Related videos
      'a[href^="/watch"].pl-video-title-link', // Playlist list view
      'a[href^="/watch"].playlist-video', // Playlist playing view
      'a[href^="/watch"].yt-ui-ellipsis', // Homepage, Subscriptions, User page & more
      'link[href*="watch"][itemprop="url"]', // Main video
    ]

    $(selectors.join(',')).each(function(i, elem) {

      var id = elem.href.match(/watch\?v=([^&]*)/)[1];
      songs.push({id: id, elem: elem});

    });
    return songs;
  },
  appendLabel: function(elem, result) {
    var labelNormal = {
      fontSize: "11px",
      marginTop: "4px",
      padding: "2px 4px 2px 4px",
      color: "white",
      borderRadius: "3px",
      display: "inline-block",
      marginLeft: "5px"
    }

    var labelWide = $.extend({}, labelNormal,{
      maxWidth: "200px",
      display: "block",
      textAlign: "center"
    })

    var labelSmall = $.extend({}, labelNormal,{
      fontSize: "10px",
      display: "inline-block",
      position: "relative",
      top: "-1px",
      marginLeft: "5px",
      marginTop: "0px",
      lineHeight: "14px",
      padding: "1px 6px"
    })

    var labelLarge = $.extend({}, labelNormal,{
      display: "inline-block",
      fontSize: "15px",
      marginLeft: "5px",
      padding: "4px 8px",
      bordeRadius: "4px",
      verticalAlign: "bottom"
    })

    if ($(elem).hasClass('yt-ui-ellipsis')) {
      var label = this.createLabel(result, labelWide);
      $(label).insertAfter($(elem).parent().parent().find('.yt-lockup-meta'));
    }
    else if ($(elem).hasClass('content-link')) {
      var label = this.createLabel(result, labelSmall);
      $(elem).find('.view-count').append(label);
    }
    else if ($(elem).hasClass('pl-video-title-link')) {
      var label = this.createLabel(result, labelNormal);
      $(elem).parent().append(label);
    }
    else if ($(elem).hasClass('playlist-video')) {
      var label = this.createLabel(result, labelNormal);
      $(elem).find('.video-uploader-byline').append(label);
    }
    else if (elem.tagName == 'LINK') {
      var label = this.createLabel(result, labelLarge);
      $('#eow-title').append(label);
    }
  },
  createLabel: function(result, labelType) {
    var verdict = this.getVerdict(result);
    var elem = $('<div class="ongaku-label"></div>');
    elem.css(labelType);
    elem.text(verdict.text);
    elem.css(this.styles[verdict.type]);
    return elem;
  },
  getVerdict: function(result) {

    if (result.unknown == 1) return this.messages.unknown;
	  if (result.b == 1) return this.messages.banned;
	  if (result.o > 0) return this.messages.overplayed;
	  if (result.t == 1) return this.messages.today;
	  if (result.w == 1) return this.messages.week;
	  if (result.m == 1) return this.messages.month;

    if(result.b !== 1 && result.o < 1 && result.t == 0 && result.w != 1)
		  return this.messages.ok(result.w);
  }
};

var Senpai = {
  parseResponse: function(response, callback) {
    var results = {};

    for(var index in response) {
      var result = response[index];
      Cache.put(result.id, result);
      results[result.id] = response[index];
    }

    callback(results);
  },
  check: function(songsToCheck, callback) {
    var payload = [];

    for(var i in songsToCheck)
      payload.push({cid: songsToCheck[i]});

    if (payload.length > 0) {
      $.post(
        'https://i.animemusic.me/animemusic/check.php?dj=6142984',
        JSON.stringify(payload),
        function(response) {
          this.parseResponse(response, callback);
        }.bind(this),
        'json'
      );
    }
  }
};

Cache.clearExpired();

Youtube.insertCheckButton().on('click', function() {
  Cache.clearExpired();
  $('.ongaku-label').remove();

  var songs = Youtube.getVideoIDs();
  var songsToCheck = Cache.getUncached(songs);

  // Append labels from cache
  for(var i in songs) {
    var cacheItem = Cache.get(songs[i].id);
    if (cacheItem)
      Youtube.appendLabel(songs[i].elem, cacheItem);
  }

  // Check, cache, and append uncached songs
  Senpai.check(songsToCheck, function(results){
    for(var i in songs) {
      if (results[songs[i].id])
        Youtube.appendLabel(songs[i].elem, results[songs[i].id]);
    }

    // Append unknown to leftovers
    for(var i in songs) {
      var cacheItem = Cache.get(songs[i].id);
      if (!cacheItem) {
        Cache.put(songs[i].id, {unknown: 1});
        Youtube.appendLabel(songs[i].elem, {unknown: 1});
      }
    }
  });
});




