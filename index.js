'use strict';
const el = require('el');

module.exports = tweet2html;

function splice(str, start, end, replacement) {
  return [str.slice(0, start), replacement, str.slice(end)].join('');
}

function adjustText(tweet) {
  tweet.textAdjustment
  .sort(function(a, b) {
    // sort in reversed order
    return b.indices[0] - a.indices[0];
  })
  .forEach(function(adj) {
    tweet.text = splice(tweet.text, adj.indices[0], adj.indices[1], adj.text);
  });
  delete tweet.textAdjustment;
}

function createTextAdjustment(opt) {
  const ta = {
    indices: opt.indices,
    text: ''
  };
  if (opt.text && opt.href) {
    ta.text = el('a', opt.text, { href: opt.href, target: "_blank" });
  }
  return ta;
}

function parseEntityType(entities, parsed, type, convertFn) {
  if(!entities[type]) {
    return;
  }
  entities[type].forEach(function(el) {
    const opts = convertFn(el);
    if (opts) {
      if (opts.photo) {
        parsed.photos = parsed.photos || [];
        parsed.photos.push(opts.photo);
      }
      if (opts.iframe) {
        parsed.iframe = opts.iframe;
      }
      const ta = createTextAdjustment(opts);
      parsed.textAdjustment.push(ta);
    }
  });
}

const entityParsers = {
  media: function(media) {
    const data = {
      indices: media.indices,
      text: ''
    };
    if (media.type === 'photo') {
      // console.log('media', media);
      /*data.photos = [];
      for (const photo of media) {
        data.photos.push({
          url: media.expanded_url,
          src: media.media_url_https
        })
      }*/
      data.photo = {
        url: media.expanded_url,
        src: media.media_url_https
      };
      return data;
    } else if (media.type === 'youtube' || media.type === 'vimeo' || media.type === 'vine'/* || media.type === 'video'*/) {
      data.iframe = {
        src: media.media_url_https,
        service: 'video ' + media.type
      };
      return data;
    }
  },
  hashtags: function(tag) {
    return {
      href: 'https://twitter.com/search/%23' + tag.text,
      text: '#' + tag.text,
      indices: tag.indices
    };
  },
  user_mentions: function(mention) {
    return {
      href: `https://twitter.com/${mention.screen_name}`,
      text: '@' + mention.screen_name,
      indices: mention.indices
    };
  },
  urls: function(url) {
    return {
      href: url.expanded_url,
      text: url.display_url,
      indices: url.indices
    };
  }
};


const urlPreParsers = [
  {
    type: 'photo',
    regex: /https?:\/\/instagram.com\/p\/([^\s\/]+)\/?/,
    toMediaUrl: function(match) {
      return 'http://instagr.am/p/' + match[1] + '/media/?size=m';
    }
  }, {
    type: 'youtube',
    regex: /https?:\/\/(?:youtu.be\/|(?:m|www).youtube.com\/watch\?v=)([^\s&]+)/,
    toMediaUrl: function(match) {
      return '//www.youtube.com/embed/' + match[1] + '?autohide=1&modestbranding=1&rel=0&theme=light';
    }
  }, {
    type: 'vimeo',
    regex: /https?:\/\/vimeo.com\/(\S+)$/,
    toMediaUrl: function(match) {
      return '//player.vimeo.com/video/' + match[1];
    }
 }, {
    type: 'vine',
    regex: /https?:\/\/vine.co\/v\/(\S+)$/,
    toMediaUrl: function(match) {
      return '//vine.co/v/' + match[1] + '/embed/simple';
    }
  }
];

function preParseUrl(entities, preParser) {
  if (entities.media && entities.media.length) {
    return; // only one media per tweet
  }
  if (!entities.urls) {
    return;
  }
  entities.media = entities.media || [];
  entities.urls = entities.urls.filter(function(url) {
    const match = url.expanded_url.match(preParser.regex);
    if (match) {
      entities.media.push({
        type: preParser.type,
        expanded_url: url.expanded_url,
        indices: url.indices,
        media_url_https: preParser.toMediaUrl(match)
      });
      return false;
    }
    return true;
  });
}

// interesting things about the tweet
// item.created_at
// item.text - tweet text
// item.full_text - tweet text for an untruncated tweet
// item.entities - hashtags, urls, user_mentions, media (type: photo)
function parseTweet(tweet, username) {
  const parsed = {
    href: 'https://twitter.com/' + username + '/status/' + tweet.id_str,
    text: tweet.full_text || tweet.text,
    textAdjustment: []
  };
  urlPreParsers.forEach(preParseUrl.bind(null, tweet.entities));
  Object.keys(entityParsers).forEach(function(type) {
    if (type === 'media' && tweet.extended_entities) {
      parseEntityType(tweet.extended_entities, parsed, type, entityParsers[type]);
    } else {
      parseEntityType(tweet.entities, parsed, type, entityParsers[type]);
    }
  });
  adjustText(parsed);
  return parsed;
}

function htmlTweet(tweet) {
  let img, content = [
    el('.text', tweet.text)
  ];
  /*if (tweet.photos) {
    for (const photo of tweet.photos) {
      img = el('img.photo__img', {src: photo.src});
      content.push(el('a.photo', img, {href: photo.url, target: '_blank'}));
    }
  }*/
  if (tweet.iframe) {
    content.push(el('iframe', { src: tweet.iframe.src, 'class': tweet.iframe.service, 'frameborder': '0' }));
  }

  return {html: content.join(''), photos: tweet.photos};
}


function tweet2html(tweet, username) {
  const parsedTweet = parseTweet(tweet, username);

  return htmlTweet(parsedTweet);
}

