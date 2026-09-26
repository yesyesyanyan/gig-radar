// One item per feed, so "Read feeds" fetches each of them.
return $('Config').first().json.feeds.map((feed) => ({ json: feed }));
